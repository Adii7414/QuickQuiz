import { Router, type IRouter, type Request, type Response } from "express";
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { and, count, desc, eq, ilike, inArray, isNull, or } from "drizzle-orm";
import { db, applications, moderationReports, questionBanks, quizzes, registrationKeys, sessions, supportCases, users } from "@workspace/db";

const router: IRouter = Router();
const auth = new Map<string, { userId: string; role: string }>();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function hash(value: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(value, salt, 64).toString("hex")}`;
}
function verify(value: string, stored: string) {
  const [salt, digest] = stored.split(":");
  if (!salt || !digest) return false;
  return timingSafeEqual(scryptSync(value, salt, 64), Buffer.from(digest, "hex"));
}
function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is required for protected key storage.");
  return createHash("sha256").update(secret).digest();
}
function encryptKey(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secretKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}
function decryptKey(value: string) {
  const [ivValue, tagValue, encryptedValue] = value.split(".");
  if (!ivValue || !tagValue || !encryptedValue) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", secretKey(), Buffer.from(ivValue, "base64url"));
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
function session(req: Request) {
  const token = req.cookies?.quiz_session;
  return token ? auth.get(token) : undefined;
}
function requireRole(role: string) {
  return (req: Request, res: Response, next: () => void): void => {
    const current = session(req);
    if (!current || current.role !== role) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}
function requireTeacherOrModerator(req: Request, res: Response, next: () => void): void {
  const current = session(req);
  if (!current || !["TEACHER", "MODERATOR"].includes(current.role)) {
    res.status(403).json({ error: "Teacher or moderator access required" });
    return;
  }
  next();
}
function issue(res: Response, user: { id: string; name: string; email: string; role: string }) {
  const token = randomBytes(32).toString("hex");
  auth.set(token, { userId: user.id, role: user.role });
  res.cookie("quiz_session", token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 1000 * 60 * 60 * 12 });
  return res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
}
function publicApplication(row: typeof applications.$inferSelect) {
  return { id: row.id, fullName: row.fullName, email: row.email, organization: row.organization, reason: row.reason, phone: row.phone, role: row.applicantRole, status: row.status, reviewNote: row.reviewNote, submittedAt: row.createdAt.toISOString(), reviewedAt: row.reviewedAt?.toISOString() ?? null };
}
function controlIsActive(active: boolean | undefined, until: string | undefined) {
  return Boolean(active && (!until || new Date(until).getTime() > Date.now()));
}
function publicParticipant<T extends { locked?: boolean; muted?: boolean; lockedUntil?: string | null; mutedUntil?: string | null }>(person: T) {
  return { ...person, locked: controlIsActive(person.locked, person.lockedUntil ?? undefined), muted: controlIsActive(person.muted, person.mutedUntil ?? undefined) };
}
function publicSupportCase(row: typeof supportCases.$inferSelect) {
  return { id: row.id, subject: row.subject, description: row.description, category: row.category, priority: row.priority, status: row.status, applicationId: row.applicationId, teacherId: row.teacherId, roomCode: row.roomCode, assignedTo: row.assignedTo, notes: row.notes, resolution: row.resolution, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), resolvedAt: row.resolvedAt?.toISOString() ?? null };
}
function publicReport(row: typeof moderationReports.$inferSelect) {
  return { id: row.id, roomCode: row.roomCode, participantId: row.participantId, participantName: row.participantName, reporterName: row.reporterName, category: row.category, details: row.details, status: row.status, resolution: row.resolution, createdAt: row.createdAt.toISOString(), resolvedAt: row.resolvedAt?.toISOString() ?? null };
}
function publicQuiz(row: typeof quizzes.$inferSelect) {
  const questions = row.questions as Array<{ prompt: string; answers: string[]; correctIndex: number }>;
  return { id: row.id, title: row.title, description: row.description, timeLimitSeconds: row.timeLimitSeconds ?? undefined, questions, questionCount: questions.length, updatedAt: row.updatedAt.toISOString() };
}
function publicQuestionBank(row: typeof questionBanks.$inferSelect) {
  const questions = row.questions as Array<{ prompt: string; answers: string[]; correctIndex: number }>;
  return { id: row.id, name: row.name, description: row.description, questions, questionCount: questions.length, updatedAt: row.updatedAt.toISOString() };
}
function publicSession(row: typeof sessions.$inferSelect, quiz?: typeof quizzes.$inferSelect) {
  const people = (row.participants as Array<{ id: string; name: string; answered: number; score: number; answers?: number[]; locked?: boolean; muted?: boolean }>) || [];
  const q = quiz ? publicQuiz(quiz) : undefined;
  const announcements = (row.announcements as Array<{ id: string; message: string; createdAt: string }>) || [];
  const questionStats = quiz
    ? (quiz.questions as Array<{ correctIndex: number }>).map((question, index) => {
        const responses = people.map((person) => person.answers?.[index]).filter((answer): answer is number => typeof answer === "number");
        return { answered: responses.length, correct: responses.filter((answer) => answer === question.correctIndex).length };
      })
    : undefined;
  return { code: row.code, status: row.status, quizTitle: quiz?.title ?? "Quiz", participantCount: people.length, currentQuestion: row.currentQuestion ?? 0, questionStartedAt: row.questionStartedAt?.toISOString() ?? null, joinFrozen: row.joinFrozen, announcements, questionStats, participants: people.map(({ answers: _answers, ...p }) => ({ ...publicParticipant(p), percentage: q?.questionCount ? Math.round((p.score / q.questionCount) * 100) : 0 })), ...(q ? { quiz: q } : {}) };
}
function automaticAdvanceReady(row: typeof sessions.$inferSelect, quiz: typeof quizzes.$inferSelect) {
  if (row.status !== "LIVE" || !quiz.timeLimitSeconds || !row.questionStartedAt) return false;
  const currentQuestion = row.currentQuestion ?? 0;
  const people = (row.participants as Array<{ answers?: number[] }>) || [];
  const timeExpired = Date.now() >= row.questionStartedAt.getTime() + quiz.timeLimitSeconds * 1000;
  const everyoneAnswered = people.length > 0 && people.every((person) => typeof person.answers?.[currentQuestion] === "number");
  return timeExpired || everyoneAnswered;
}
async function autoAdvanceSession(row: typeof sessions.$inferSelect, quiz: typeof quizzes.$inferSelect) {
  if (!automaticAdvanceReady(row, quiz)) return row;
  const currentQuestion = row.currentQuestion ?? 0;
  const lastQuestion = currentQuestion >= (quiz.questions as unknown[]).length - 1;
  const update = lastQuestion
    ? { status: "COMPLETE", questionStartedAt: null }
    : { currentQuestion: currentQuestion + 1, questionStartedAt: new Date() };
  return (await db.update(sessions).set(update).where(and(eq(sessions.code, row.code), eq(sessions.status, "LIVE"), eq(sessions.currentQuestion, currentQuestion))).returning())[0] ?? row;
}
async function publicModerationSession(row: typeof sessions.$inferSelect) {
  const [quiz, teacher] = await Promise.all([
    db.select().from(quizzes).where(eq(quizzes.id, row.quizId)).limit(1),
    db.select().from(users).where(eq(users.id, row.teacherId)).limit(1),
  ]);
  const questionCount = quiz[0] ? (quiz[0].questions as unknown[]).length : 0;
  const questions = (quiz[0]?.questions as Array<{ prompt: string; answers: string[]; correctIndex: number }> | undefined) ?? [];
  const people = (row.participants as Array<{ id: string; name: string; answered: number; score: number; locked?: boolean; muted?: boolean }>) || [];
  const questionStats = questions.map((question, index) => {
    const answers = (row.participants as Array<{ answers?: number[] }> || []).map((person) => person.answers?.[index]).filter((answer): answer is number => typeof answer === "number");
    return { answered: answers.length, correct: answers.filter((answer) => answer === question.correctIndex).length };
  });
  const liveQuestion = questions[row.currentQuestion ?? 0];
  return {
    code: row.code,
    quizTitle: quiz[0]?.title ?? "Quiz",
    teacherName: teacher[0]?.name ?? "Unknown teacher",
    teacherEmail: teacher[0]?.email ?? "",
    status: row.status,
    participantCount: people.length,
    currentQuestion: row.currentQuestion ?? 0,
    questionCount,
    createdAt: row.createdAt.toISOString(),
    joinFrozen: row.joinFrozen,
    announcements: (row.announcements as Array<{ id: string; message: string; createdAt: string }>) || [],
    liveQuestion: liveQuestion ? { index: row.currentQuestion ?? 0, prompt: liveQuestion.prompt, answers: liveQuestion.answers, correctIndex: liveQuestion.correctIndex } : null,
    questionStats,
    bannedNames: (row.bannedNames as string[]) || [],
    participants: people.map((person) => ({ ...publicParticipant(person), percentage: questionCount ? Math.round((person.score / questionCount) * 100) : 0 })),
  };
}

router.post("/auth/teacher/login", async (req, res) => {
  const email = String(req.body?.email ?? "").toLowerCase();
  const password = String(req.body?.password ?? "");
  const rows = await db.select().from(users).where(and(eq(users.email, email), eq(users.role, "TEACHER"))).limit(1);
  if (!rows[0] || !verify(password, rows[0].passwordHash)) return res.status(401).json({ error: "Invalid credentials" });
  if (rows[0].status === "SUSPENDED") return res.status(403).json({ code: "TEACHER_SUSPENDED", error: "Teacher account suspended" });
  if (rows[0].status !== "ACTIVE") return res.status(401).json({ error: "Invalid credentials" });
  return issue(res, rows[0]);
});
router.post("/auth/moderator/login", async (req, res) => {
  const email = String(req.body?.email ?? "").toLowerCase();
  const password = String(req.body?.password ?? "");
  const configuredEmail = process.env.MODERATOR_EMAIL?.toLowerCase();
  const configuredPassword = process.env.MODERATOR_PASSWORD;
  if (!configuredEmail || !configuredPassword || email !== configuredEmail || password !== configuredPassword) return res.status(401).json({ error: "Invalid credentials" });
  const id = `moderator-${Buffer.from(configuredEmail).toString("hex").slice(0, 20)}`;
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  const user = rows[0] ?? (await db.insert(users).values({ id, name: "Moderator", email: configuredEmail, passwordHash: hash(configuredPassword), role: "MODERATOR" }).returning())[0];
  return issue(res, user);
});
router.post("/auth/logout", (req, res) => {
  const token = req.cookies?.quiz_session;
  if (token) auth.delete(token);
  res.clearCookie("quiz_session");
  return res.status(204).end();
});
router.get("/auth/me", async (req, res) => {
  const current = session(req);
  if (!current) return res.status(401).json({ error: "Not authenticated" });
  const row = (await db.select().from(users).where(eq(users.id, current.userId)).limit(1))[0];
  if (!row) return res.status(401).json({ error: "Not authenticated" });
  if (row.role === "TEACHER" && row.status === "SUSPENDED") {
    const token = req.cookies?.quiz_session;
    if (token) auth.delete(token);
    res.clearCookie("quiz_session");
    return res.status(403).json({ code: "TEACHER_SUSPENDED", error: "Teacher account suspended" });
  }
  return res.json({ id: row.id, name: row.name, email: row.email, role: row.role });
});
router.post("/applications", async (req, res) => {
  const { fullName, email, organization, reason, phone, role } = req.body ?? {};
  if (!fullName || !emailPattern.test(email) || !organization || String(reason).length < 10) return res.status(400).json({ error: "Please complete all required fields." });
  const pendingApplication = (await db.select().from(applications).where(and(eq(applications.email, String(email).toLowerCase()), eq(applications.status, "PENDING"))).limit(1))[0];
  if (pendingApplication) return res.status(409).json({ error: "You already have an application awaiting review.", applicationId: pendingApplication.id });
  const id = `APP-${randomBytes(5).toString("hex").toUpperCase()}`;
  const row = (await db.insert(applications).values({ id, fullName, email: email.toLowerCase(), organization, reason, phone: phone || null, applicantRole: role || null }).returning())[0];
  return res.status(201).json({ id: row.id, status: row.status, submittedAt: row.createdAt.toISOString() });
});
router.get("/applications", requireRole("MODERATOR"), async (req, res) => {
  const search = String(req.query.search ?? "");
  const status = String(req.query.status ?? "");
  const filters = [];
  if (status && ["PENDING", "APPROVED", "REJECTED"].includes(status)) filters.push(eq(applications.status, status));
  if (search) filters.push(or(ilike(applications.id, `%${search}%`), ilike(applications.fullName, `%${search}%`), ilike(applications.email, `%${search}%`), ilike(applications.organization, `%${search}%`)));
  const rows = await db.select().from(applications).where(filters.length ? and(...filters) : undefined).orderBy(desc(applications.createdAt));
  return res.json(rows.map(publicApplication));
});
router.get("/applications/:id", requireRole("MODERATOR"), async (req, res) => {
  const id = String(req.params.id);
  const row = (await db.select().from(applications).where(eq(applications.id, id)).limit(1))[0];
  return row ? res.json(publicApplication(row)) : res.status(404).json({ error: "Application not found" });
});
router.get("/application-status/:id", async (req, res) => {
  const id = String(req.params.id).trim().toUpperCase();
  const row = (await db.select().from(applications).where(eq(applications.id, id)).limit(1))[0];
  return row
    ? res.json({ id: row.id, status: row.status, submittedAt: row.createdAt.toISOString(), reviewedAt: row.reviewedAt?.toISOString() ?? null, reviewNote: row.reviewNote })
    : res.status(404).json({ error: "We could not find an application with that ID." });
});
router.post("/applications/:id/decision", requireRole("MODERATOR"), async (req, res) => {
  const decision = req.body?.decision;
  if (!["APPROVED", "REJECTED", "NEEDS_INFO"].includes(decision)) return res.status(400).json({ error: "Invalid decision" });
  const reviewNote = String(req.body?.reviewNote ?? "").trim() || null;
  const id = String(req.params.id);
  const row = (await db.select().from(applications).where(eq(applications.id, id)).limit(1))[0];
  if (!row) return res.status(404).json({ error: "Application not found" });
  const reviewedAt = new Date();
  const updated = (await db.update(applications).set({ status: decision, reviewNote, reviewedAt }).where(eq(applications.id, row.id)).returning())[0];
  if (decision !== "APPROVED") return res.json({ application: publicApplication(updated), registrationKey: null, expiresAt: null });
  const raw = `TCH-${randomBytes(18).toString("base64url")}`;
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 72);
  const existingKey = (await db.select().from(registrationKeys).where(eq(registrationKeys.applicationId, row.id)).limit(1))[0];
  if (existingKey) {
    const existingRaw = existingKey.encryptedKey ? decryptKey(existingKey.encryptedKey) : null;
    if (existingRaw) return res.json({ application: publicApplication(updated), registrationKey: existingRaw, expiresAt: existingKey.expiresAt.toISOString() });
    await db.update(registrationKeys).set({ keyHash: hash(raw), encryptedKey: encryptKey(raw), expiresAt: expires, usedAt: null }).where(eq(registrationKeys.id, existingKey.id));
  } else {
    await db.insert(registrationKeys).values({ id: randomUUID(), applicationId: row.id, keyHash: hash(raw), encryptedKey: encryptKey(raw), expiresAt: expires });
  }
  return res.json({ application: publicApplication(updated), registrationKey: raw, expiresAt: expires.toISOString() });
});
router.get("/moderator/dashboard", requireRole("MODERATOR"), async (_req, res) => {
  const [pendingApplications, openCases, openReports, activeRooms, activeTeachers, suspendedTeachers] = await Promise.all([
    db.select({ value: count() }).from(applications).where(eq(applications.status, "PENDING")),
    db.select({ value: count() }).from(supportCases).where(inArray(supportCases.status, ["OPEN", "IN_PROGRESS", "WAITING_ON_APPLICANT"])),
    db.select({ value: count() }).from(moderationReports).where(inArray(moderationReports.status, ["OPEN", "REVIEWING"])),
    db.select({ value: count() }).from(sessions).where(inArray(sessions.status, ["LOBBY", "LIVE", "PAUSED"])),
    db.select({ value: count() }).from(users).where(and(eq(users.role, "TEACHER"), eq(users.status, "ACTIVE"))),
    db.select({ value: count() }).from(users).where(and(eq(users.role, "TEACHER"), eq(users.status, "SUSPENDED"))),
  ]);
  return res.json({
    pendingApplications: Number(pendingApplications[0]?.value ?? 0),
    openCases: Number(openCases[0]?.value ?? 0),
    openReports: Number(openReports[0]?.value ?? 0),
    activeRooms: Number(activeRooms[0]?.value ?? 0),
    activeTeachers: Number(activeTeachers[0]?.value ?? 0),
    suspendedTeachers: Number(suspendedTeachers[0]?.value ?? 0),
  });
});
router.get("/moderator/support-cases", requireRole("MODERATOR"), async (req, res) => {
  const status = String(req.query.status ?? "").toUpperCase();
  const priority = String(req.query.priority ?? "").toUpperCase();
  const filters = [];
  if (["OPEN", "IN_PROGRESS", "WAITING_ON_APPLICANT", "RESOLVED", "CLOSED"].includes(status)) filters.push(eq(supportCases.status, status));
  if (["LOW", "NORMAL", "HIGH", "URGENT"].includes(priority)) filters.push(eq(supportCases.priority, priority));
  const rows = await db.select().from(supportCases).where(filters.length ? and(...filters) : undefined).orderBy(desc(supportCases.updatedAt));
  return res.json(rows.map(publicSupportCase));
});
router.post("/moderator/support-cases", requireRole("MODERATOR"), async (req, res) => {
  const subject = String(req.body?.subject ?? "").trim();
  const description = String(req.body?.description ?? "").trim();
  const category = String(req.body?.category ?? "GENERAL").toUpperCase();
  const priority = String(req.body?.priority ?? "NORMAL").toUpperCase();
  if (subject.length < 3 || description.length < 3 || !["GENERAL", "APPLICATION", "ACCOUNT", "ROOM", "SAFETY"].includes(category) || !["LOW", "NORMAL", "HIGH", "URGENT"].includes(priority)) return res.status(400).json({ error: "Provide a valid subject, description, category, and priority." });
  const row = (await db.insert(supportCases).values({ id: `CASE-${randomBytes(5).toString("hex").toUpperCase()}`, subject, description, category, priority, applicationId: req.body?.applicationId || null, teacherId: req.body?.teacherId || null, roomCode: req.body?.roomCode || null, assignedTo: req.body?.assignedTo || null }).returning())[0];
  return res.status(201).json(publicSupportCase(row));
});
router.post("/moderator/support-cases/:id/note", requireRole("MODERATOR"), async (req, res) => {
  const id = String(req.params.id);
  const body = String(req.body?.body ?? "").trim();
  if (!body || body.length > 1000) return res.status(400).json({ error: "Notes must be between 1 and 1000 characters." });
  const row = (await db.select().from(supportCases).where(eq(supportCases.id, id)).limit(1))[0];
  if (!row) return res.status(404).json({ error: "Support case not found." });
  const notes = (row.notes as Array<{ id: string; body: string; author: string; createdAt: string }>) || [];
  const updated = (await db.update(supportCases).set({ notes: [...notes, { id: randomUUID(), body, author: "Moderator", createdAt: new Date().toISOString() }], status: row.status === "OPEN" ? "IN_PROGRESS" : row.status, updatedAt: new Date() }).where(eq(supportCases.id, id)).returning())[0];
  return res.json(publicSupportCase(updated));
});
router.post("/moderator/support-cases/:id/status", requireRole("MODERATOR"), async (req, res) => {
  const id = String(req.params.id);
  const status = String(req.body?.status ?? "").toUpperCase();
  const resolution = String(req.body?.resolution ?? "").trim() || null;
  if (!["OPEN", "IN_PROGRESS", "WAITING_ON_APPLICANT", "RESOLVED", "CLOSED"].includes(status)) return res.status(400).json({ error: "Invalid support case status." });
  const row = (await db.update(supportCases).set({ status, resolution, updatedAt: new Date(), resolvedAt: ["RESOLVED", "CLOSED"].includes(status) ? new Date() : null }).where(eq(supportCases.id, id)).returning())[0];
  return row ? res.json(publicSupportCase(row)) : res.status(404).json({ error: "Support case not found." });
});
router.post("/reports", async (req, res) => {
  const roomCode = String(req.body?.roomCode ?? "").trim().toUpperCase();
  const category = String(req.body?.category ?? "OTHER").toUpperCase();
  const details = String(req.body?.details ?? "").trim();
  if (roomCode.length < 3 || details.length < 3 || details.length > 1000 || !["HARASSMENT", "DISRUPTION", "INAPPROPRIATE_NAME", "TECHNICAL", "OTHER"].includes(category)) return res.status(400).json({ error: "Provide a room, category, and report details." });
  const room = (await db.select({ code: sessions.code }).from(sessions).where(eq(sessions.code, roomCode)).limit(1))[0];
  if (!room) return res.status(404).json({ error: "Room not found." });
  const row = (await db.insert(moderationReports).values({ id: `RPT-${randomBytes(5).toString("hex").toUpperCase()}`, roomCode, participantId: req.body?.participantId || null, participantName: req.body?.participantName || null, reporterName: req.body?.reporterName || null, category, details }).returning())[0];
  return res.status(201).json(publicReport(row));
});
router.get("/moderator/reports", requireRole("MODERATOR"), async (req, res) => {
  const status = String(req.query.status ?? "").toUpperCase();
  const filters = [];
  if (["OPEN", "REVIEWING", "RESOLVED", "DISMISSED"].includes(status)) filters.push(eq(moderationReports.status, status));
  const rows = await db.select().from(moderationReports).where(filters.length ? and(...filters) : undefined).orderBy(desc(moderationReports.createdAt));
  return res.json(rows.map(publicReport));
});
router.post("/moderator/reports/:id/resolve", requireRole("MODERATOR"), async (req, res) => {
  const status = String(req.body?.status ?? "").toUpperCase();
  if (!["RESOLVED", "DISMISSED"].includes(status)) return res.status(400).json({ error: "Invalid report resolution." });
  const resolution = String(req.body?.resolution ?? "").trim() || null;
  const row = (await db.update(moderationReports).set({ status, resolution, resolvedAt: new Date() }).where(eq(moderationReports.id, String(req.params.id))).returning())[0];
  return row ? res.json(publicReport(row)) : res.status(404).json({ error: "Report not found." });
});
router.get("/registration-keys/:applicationId", requireRole("MODERATOR"), async (req, res) => {
  const applicationId = String(req.params.applicationId);
  const row = (await db.select().from(registrationKeys).where(eq(registrationKeys.applicationId, applicationId)).limit(1))[0];
  if (!row || !row.encryptedKey) return res.status(404).json({ error: "Registration key not found." });
  const registrationKey = decryptKey(row.encryptedKey);
  if (!registrationKey) return res.status(500).json({ error: "Registration key could not be recovered." });
  return res.json({ registrationKey, expiresAt: row.expiresAt.toISOString(), usedAt: row.usedAt?.toISOString() ?? null });
});
router.post("/teacher-registration", async (req, res) => {
  const { registrationKey, name, email, password, passwordConfirmation } = req.body ?? {};
  if (!registrationKey || !name || !emailPattern.test(email) || password !== passwordConfirmation || String(password).length < 8) return res.status(400).json({ error: "Check your registration details." });
  const candidates = await db.select().from(registrationKeys).where(isNull(registrationKeys.usedAt));
  const key = candidates.find(k => k.expiresAt > new Date() && verify(registrationKey, k.keyHash));
  if (!key) return res.status(400).json({ error: "This registration key is invalid, expired, or already used." });
  const app = (await db.select().from(applications).where(eq(applications.id, key.applicationId)).limit(1))[0];
  if (!app || app.status !== "APPROVED") return res.status(400).json({ error: "This application is not approved." });
  const user = (await db.insert(users).values({ id: randomUUID(), name, email: email.toLowerCase(), passwordHash: hash(password), role: "TEACHER" }).returning())[0];
  await db.update(registrationKeys).set({ usedAt: new Date() }).where(eq(registrationKeys.id, key.id));
  return issue(res, user);
});
router.get("/teachers", requireRole("MODERATOR"), async (_req, res) => {
  const rows = await db.select().from(users).where(eq(users.role, "TEACHER")).orderBy(desc(users.createdAt));
  return res.json(rows.map(row => ({ id: row.id, name: row.name, email: row.email, status: row.status, organization: "" })));
});
router.post("/teachers/:id/status", requireRole("MODERATOR"), async (req, res) => {
  const status = req.body?.status;
  if (!["ACTIVE", "SUSPENDED"].includes(status)) return res.status(400).json({ error: "Invalid status" });
  const id = String(req.params.id);
  const row = (await db.update(users).set({ status }).where(and(eq(users.id, id), eq(users.role, "TEACHER"))).returning())[0];
  return row ? res.json({ id: row.id, name: row.name, email: row.email, status: row.status, organization: "" }) : res.status(404).json({ error: "Teacher not found" });
});
router.get("/moderator/users", requireRole("MODERATOR"), async (req, res) => {
  const search = String(req.query.search ?? "").trim();
  const role = String(req.query.role ?? "").toUpperCase();
  const filters = [];
  if (search) filters.push(or(ilike(users.name, `%${search}%`), ilike(users.email, `%${search}%`)));
  if (["TEACHER", "STUDENT", "MODERATOR"].includes(role)) filters.push(eq(users.role, role));
  const rows = await db.select().from(users).where(filters.length ? and(...filters) : undefined).orderBy(desc(users.createdAt));
  return res.json(rows.map((row) => ({ id: row.id, name: row.name, email: row.email, role: row.role, status: row.status, createdAt: row.createdAt.toISOString() })));
});
router.post("/moderator/users/:id/status", requireRole("MODERATOR"), async (req, res) => {
  const status = req.body?.status;
  if (!["ACTIVE", "SUSPENDED"].includes(status)) return res.status(400).json({ error: "Invalid account status" });
  const id = String(req.params.id);
  const current = (await db.select().from(users).where(eq(users.id, id)).limit(1))[0];
  if (!current || current.role === "MODERATOR") return res.status(404).json({ error: "Account not found" });
  const row = (await db.update(users).set({ status }).where(eq(users.id, id)).returning())[0];
  return res.json({ id: row.id, name: row.name, email: row.email, role: row.role, status: row.status, createdAt: row.createdAt.toISOString() });
});
router.get("/moderator/sessions", requireRole("MODERATOR"), async (_req, res) => {
  const rows = await db.select().from(sessions).where(inArray(sessions.status, ["LOBBY", "LIVE", "PAUSED"])).orderBy(desc(sessions.createdAt));
  return res.json(await Promise.all(rows.map(publicModerationSession)));
});
router.post("/moderator/sessions/:code/action", requireTeacherOrModerator, async (req, res) => {
  const code = String(req.params.code).toUpperCase();
  const action = String(req.body?.action ?? "");
  const allowed = ["END", "PAUSE", "RESUME", "FREEZE_JOINS", "UNFREEZE_JOINS", "REMOVE_PARTICIPANT", "LOCK_PARTICIPANT", "UNLOCK_PARTICIPANT", "MUTE_PARTICIPANT", "UNMUTE_PARTICIPANT", "TEMP_LOCK", "TEMP_MUTE", "WARN_PARTICIPANT", "BAN_PARTICIPANT", "UNBAN_PARTICIPANT", "SEND_ANNOUNCEMENT", "SKIP_QUESTION", "RESTART_QUESTION", "EXTEND_TIME"];
  if (!allowed.includes(action)) return res.status(400).json({ error: "Invalid moderation action" });
  const row = (await db.select().from(sessions).where(eq(sessions.code, code)).limit(1))[0];
  if (!row) return res.status(404).json({ error: "Session not found" });
  const current = session(req)!;
  if (current.role === "TEACHER" && row.teacherId !== current.userId) return res.status(403).json({ error: "You do not own this quiz session" });
  const people = (row.participants as Array<{ id: string; name: string; answered: number; score: number; locked?: boolean; muted?: boolean; warningCount?: number; lockedUntil?: string | null; mutedUntil?: string | null }>) || [];
  const quiz = (await db.select().from(quizzes).where(eq(quizzes.id, row.quizId)).limit(1))[0];
  if (!quiz) return res.status(404).json({ error: "Quiz not found" });
  const questions = quiz.questions as Array<{ correctIndex: number }>;
  let update: Partial<typeof sessions.$inferInsert> = {};
  if (action === "END") update = { status: "COMPLETE", questionStartedAt: null };
  if (action === "PAUSE") {
    if (row.status !== "LIVE") return res.status(400).json({ error: "Only a live session can be paused." });
    update = { status: "PAUSED", questionStartedAt: null };
  }
  if (action === "RESUME") {
    if (row.status !== "PAUSED") return res.status(400).json({ error: "Only a paused session can be resumed." });
    update = { status: "LIVE", questionStartedAt: new Date() };
  }
  if (action === "FREEZE_JOINS") update = { joinFrozen: true };
  if (action === "UNFREEZE_JOINS") update = { joinFrozen: false };
  if (action === "REMOVE_PARTICIPANT") {
    const participantId = String(req.body?.participantId ?? "");
    if (!participantId || !people.some((person) => person.id === participantId)) return res.status(404).json({ error: "Participant not found" });
    update = { participants: people.filter((person) => person.id !== participantId) };
  }
  if (["LOCK_PARTICIPANT", "UNLOCK_PARTICIPANT", "MUTE_PARTICIPANT", "UNMUTE_PARTICIPANT", "TEMP_LOCK", "TEMP_MUTE", "WARN_PARTICIPANT", "BAN_PARTICIPANT"].includes(action)) {
    const participantId = String(req.body?.participantId ?? "");
    const person = people.find((candidate) => candidate.id === participantId);
    if (!person) return res.status(404).json({ error: "Participant not found" });
    if (action === "BAN_PARTICIPANT") {
      const bannedNames = (row.bannedNames as string[]) || [];
      update = {
        participants: people.filter((candidate) => candidate.id !== participantId),
        bannedNames: [...new Set([...bannedNames, person.name.trim().toLowerCase()])],
      };
    } else {
      const seconds = Number(req.body?.seconds ?? 600);
      if (["TEMP_LOCK", "TEMP_MUTE"].includes(action) && (!Number.isInteger(seconds) || seconds < 5 || seconds > 3600)) return res.status(400).json({ error: "Timed controls must be between 5 seconds and 1 hour." });
      if (action === "LOCK_PARTICIPANT") { person.locked = true; person.lockedUntil = null; }
      if (action === "UNLOCK_PARTICIPANT") { person.locked = false; person.lockedUntil = null; }
      if (action === "TEMP_LOCK") { person.locked = true; person.lockedUntil = new Date(Date.now() + seconds * 1000).toISOString(); }
      if (action === "MUTE_PARTICIPANT") { person.muted = true; person.mutedUntil = null; }
      if (action === "UNMUTE_PARTICIPANT") { person.muted = false; person.mutedUntil = null; }
      if (action === "TEMP_MUTE") { person.muted = true; person.mutedUntil = new Date(Date.now() + seconds * 1000).toISOString(); }
      if (action === "WARN_PARTICIPANT") person.warningCount = (person.warningCount ?? 0) + 1;
      update = { participants: people };
    }
  }
  if (action === "UNBAN_PARTICIPANT") {
    const name = String(req.body?.participantName ?? "").trim().toLowerCase();
    if (!name) return res.status(400).json({ error: "Participant name is required." });
    update = { bannedNames: ((row.bannedNames as string[]) || []).filter((bannedName) => bannedName !== name) };
  }
  if (action === "SEND_ANNOUNCEMENT") {
    const message = String(req.body?.message ?? "").trim();
    if (message.length < 1 || message.length > 280) return res.status(400).json({ error: "Announcements must be between 1 and 280 characters." });
    const announcements = (row.announcements as Array<{ id: string; message: string; createdAt: string }>) || [];
    update = { announcements: [...announcements, { id: randomUUID(), message, createdAt: new Date().toISOString() }].slice(-20) };
  }
  if (action === "SKIP_QUESTION") {
    if (row.status !== "LIVE") return res.status(400).json({ error: "Only a live session can skip a question." });
    const currentQuestion = row.currentQuestion ?? 0;
    const lastQuestion = currentQuestion >= questions.length - 1;
    update = lastQuestion
      ? { status: "COMPLETE", questionStartedAt: null }
      : { currentQuestion: currentQuestion + 1, questionStartedAt: new Date() };
  }
  if (action === "RESTART_QUESTION") {
    if (!["LIVE", "PAUSED"].includes(row.status)) return res.status(400).json({ error: "Start the quiz before restarting a question." });
    const currentQuestion = row.currentQuestion ?? 0;
    const resetPeople = people.map((person) => {
      const withAnswers = person as typeof person & { answers?: number[] };
      const answers = [...(withAnswers.answers ?? [])];
      const previousAnswer = answers[currentQuestion];
      if (previousAnswer === undefined) return person;
      if (previousAnswer === questions[currentQuestion]?.correctIndex) person.score = Math.max(0, person.score - 1);
      answers[currentQuestion] = undefined as unknown as number;
      withAnswers.answers = answers;
      person.answered = answers.filter((answer) => typeof answer === "number").length;
      return person;
    });
    update = { participants: resetPeople, questionStartedAt: row.status === "LIVE" ? new Date() : null };
  }
  if (action === "EXTEND_TIME") {
    if (row.status !== "LIVE" || !row.questionStartedAt || !quiz.timeLimitSeconds) return res.status(400).json({ error: "Only a live timed question can be extended." });
    const seconds = Number(req.body?.seconds);
    if (!Number.isInteger(seconds) || seconds < 5 || seconds > 120) return res.status(400).json({ error: "Choose an extension between 5 and 120 seconds." });
    update = { questionStartedAt: new Date(row.questionStartedAt.getTime() + seconds * -1000) };
  }
  const updated = (await db.update(sessions).set(update).where(eq(sessions.code, code)).returning())[0];
  return res.json(current.role === "TEACHER" ? publicSession(updated, quiz) : await publicModerationSession(updated));
});

router.get("/quizzes", requireRole("TEACHER"), async (req, res) => {
  const current = session(req)!;
  const rows = await db.select().from(quizzes).where(eq(quizzes.teacherId, current.userId)).orderBy(desc(quizzes.updatedAt));
  return res.json(rows.map(publicQuiz));
});
router.get("/teacher/stats", requireRole("TEACHER"), async (req, res) => {
  const current = session(req)!;
  const [result] = await db.select({ roomsHosted: count(sessions.code) }).from(sessions).where(eq(sessions.teacherId, current.userId));
  return res.json({ roomsHosted: Number(result?.roomsHosted ?? 0) });
});
router.post("/quizzes", requireRole("TEACHER"), async (req, res) => {
  const current = session(req)!;
  const { title, description = "", timeLimitSeconds = 0, questions = [] } = req.body ?? {};
  const timer = Number(timeLimitSeconds);
  if (!title || !Array.isArray(questions) || questions.some((q: { answers?: string[] }) => !Array.isArray(q.answers) || q.answers.length !== 4) || !Number.isInteger(timer) || timer < 0 || timer > 600) return res.status(400).json({ error: "A quiz needs a title, valid timer settings, and exactly four answers per question." });
  const row = (await db.insert(quizzes).values({ id: randomUUID(), teacherId: current.userId, title, description, timeLimitSeconds: timer || null, questions }).returning())[0];
  return res.status(201).json(publicQuiz(row));
});
router.patch("/quizzes/:id", requireRole("TEACHER"), async (req, res) => {
  const current = session(req)!;
  const { title, description = "", timeLimitSeconds = 0, questions = [] } = req.body ?? {};
  const id = String(req.params.id);
  const timer = Number(timeLimitSeconds);
  if (!title || !Array.isArray(questions) || questions.some((q: { answers?: string[] }) => !Array.isArray(q.answers) || q.answers.length !== 4) || !Number.isInteger(timer) || timer < 0 || timer > 600) return res.status(400).json({ error: "A quiz needs a title, valid timer settings, and exactly four answers per question." });
  const row = (await db.update(quizzes).set({ title, description, timeLimitSeconds: timer || null, questions, updatedAt: new Date() }).where(and(eq(quizzes.id, id), eq(quizzes.teacherId, current.userId))).returning())[0];
  return row ? res.json(publicQuiz(row)) : res.status(404).json({ error: "Quiz not found" });
});
router.delete("/quizzes/:id", requireRole("TEACHER"), async (req, res) => {
  const current = session(req)!;
  const id = String(req.params.id);
  await db.delete(quizzes).where(and(eq(quizzes.id, id), eq(quizzes.teacherId, current.userId)));
  return res.status(204).end();
});
router.get("/question-banks", requireRole("TEACHER"), async (req, res) => {
  const current = session(req)!;
  const rows = await db.select().from(questionBanks).where(eq(questionBanks.teacherId, current.userId)).orderBy(desc(questionBanks.updatedAt));
  return res.json(rows.map(publicQuestionBank));
});
router.post("/question-banks", requireRole("TEACHER"), async (req, res) => {
  const current = session(req)!;
  const { name, description = "", questions = [] } = req.body ?? {};
  if (!name || !Array.isArray(questions) || questions.length === 0 || questions.some((q: { prompt?: string; answers?: string[]; correctIndex?: number }) => !q.prompt || !Array.isArray(q.answers) || q.answers.length !== 4 || !Number.isInteger(q.correctIndex) || Number(q.correctIndex) < 0 || Number(q.correctIndex) > 3)) {
    return res.status(400).json({ error: "A question bank needs a name and valid four-choice questions." });
  }
  const row = (await db.insert(questionBanks).values({ id: randomUUID(), teacherId: current.userId, name, description, questions }).returning())[0];
  return res.status(201).json(publicQuestionBank(row));
});
router.patch("/question-banks/:id", requireRole("TEACHER"), async (req, res) => {
  const current = session(req)!;
  const { name, description = "", questions = [] } = req.body ?? {};
  const id = String(req.params.id);
  if (!name || !Array.isArray(questions) || questions.length === 0 || questions.some((q: { prompt?: string; answers?: string[]; correctIndex?: number }) => !q.prompt || !Array.isArray(q.answers) || q.answers.length !== 4 || !Number.isInteger(q.correctIndex) || Number(q.correctIndex) < 0 || Number(q.correctIndex) > 3)) {
    return res.status(400).json({ error: "A question bank needs a name and valid four-choice questions." });
  }
  const row = (await db.update(questionBanks).set({ name, description, questions, updatedAt: new Date() }).where(and(eq(questionBanks.id, id), eq(questionBanks.teacherId, current.userId))).returning())[0];
  return row ? res.json(publicQuestionBank(row)) : res.status(404).json({ error: "Question bank not found" });
});
router.delete("/question-banks/:id", requireRole("TEACHER"), async (req, res) => {
  const current = session(req)!;
  await db.delete(questionBanks).where(and(eq(questionBanks.id, String(req.params.id)), eq(questionBanks.teacherId, current.userId)));
  return res.status(204).end();
});
router.post("/quizzes/:id/host", requireRole("TEACHER"), async (req, res) => {
  const current = session(req)!;
  const id = String(req.params.id);
  const quiz = (await db.select().from(quizzes).where(and(eq(quizzes.id, id), eq(quizzes.teacherId, current.userId))).limit(1))[0];
  if (!quiz) return res.status(404).json({ error: "Quiz not found" });
  const code = randomBytes(3).toString("hex").toUpperCase();
  const row = (await db.insert(sessions).values({ code, quizId: quiz.id, teacherId: current.userId, participants: [] }).returning())[0];
  return res.status(201).json(publicSession(row, quiz));
});
router.get("/sessions/:code", async (req, res) => {
  const code = String(req.params.code).toUpperCase();
  const row = (await db.select().from(sessions).where(eq(sessions.code, code)).limit(1))[0];
  if (!row) return res.status(404).json({ error: "Quiz session not found" });
  const quiz = (await db.select().from(quizzes).where(eq(quizzes.id, row.quizId)).limit(1))[0];
  const currentRow = quiz ? await autoAdvanceSession(row, quiz) : row;
  return res.json(publicSession(currentRow, quiz));
});
router.post("/sessions/:code", async (req, res) => {
  const code = String(req.params.code).toUpperCase();
  const row = (await db.select().from(sessions).where(eq(sessions.code, code)).limit(1))[0];
  if (!row || row.status !== "LOBBY" || row.joinFrozen) return res.status(400).json({ code: "ROOM_NOT_ACCEPTING", error: "This quiz is no longer accepting players." });
  const name = String(req.body?.name ?? "").trim();
  if (!name) return res.status(400).json({ error: "Enter your name." });
  const bannedNames = (row.bannedNames as string[]) || [];
  if (bannedNames.includes(name.toLowerCase())) return res.status(403).json({ code: "PARTICIPANT_BANNED", error: "You have been removed from this room." });
  const participant = { id: randomUUID(), name, answered: 0, score: 0 };
  const people = [...((row.participants as typeof participant[]) || []), participant];
  await db.update(sessions).set({ participants: people }).where(eq(sessions.code, code));
  return res.status(201).json({ ...participant, percentage: 0 });
});
router.post("/sessions/:code/start", requireRole("TEACHER"), async (req, res) => {
  const current = session(req)!;
  const code = String(req.params.code).toUpperCase();
  const row = (await db.update(sessions).set({ status: "LIVE", currentQuestion: 0, questionStartedAt: new Date() }).where(and(eq(sessions.code, code), eq(sessions.teacherId, current.userId))).returning())[0];
  if (!row) return res.status(404).json({ error: "Session not found" });
  const quiz = (await db.select().from(quizzes).where(eq(quizzes.id, row.quizId)).limit(1))[0];
  return res.json(publicSession(row, quiz));
});
router.post("/sessions/:code/advance", requireRole("TEACHER"), async (req, res) => {
  const current = session(req)!;
  const code = String(req.params.code).toUpperCase();
  const row = (await db.select().from(sessions).where(and(eq(sessions.code, code), eq(sessions.teacherId, current.userId))).limit(1))[0];
  if (!row) return res.status(404).json({ error: "Session not found" });
  const quiz = (await db.select().from(quizzes).where(eq(quizzes.id, row.quizId)).limit(1))[0];
  if (!quiz) return res.status(404).json({ error: "Quiz not found" });
  if (row.status === "LOBBY") return res.status(400).json({ error: "Start the quiz before advancing." });
  if (row.status === "PAUSED") return res.status(400).json({ error: "Resume the quiz before advancing." });
  if (row.status === "COMPLETE") return res.json(publicSession(row, quiz));
  const lastQuestion = (row.currentQuestion ?? 0) >= (quiz.questions as unknown[]).length - 1;
  const updated = (await db.update(sessions).set(lastQuestion ? { status: "COMPLETE", questionStartedAt: null } : { currentQuestion: (row.currentQuestion ?? 0) + 1, questionStartedAt: new Date() }).where(eq(sessions.code, code)).returning())[0];
  return res.json(publicSession(updated, quiz));
});
router.get("/sessions/:code/results", requireRole("TEACHER"), async (req, res) => {
  const current = session(req)!;
  const code = String(req.params.code).toUpperCase();
  const row = (await db.select().from(sessions).where(and(eq(sessions.code, code), eq(sessions.teacherId, current.userId))).limit(1))[0];
  if (!row) return res.status(404).json({ error: "Session not found" });
  const quiz = (await db.select().from(quizzes).where(eq(quizzes.id, row.quizId)).limit(1))[0];
  if (!quiz) return res.status(404).json({ error: "Quiz not found" });

  const questions = quiz.questions as Array<{ prompt: string; answers: string[]; correctIndex: number }>;
  const people = (row.participants as Array<{ id: string; name: string; score: number; answers?: Array<number | undefined> }>) || [];
  const participants = people
    .map((person) => ({
      id: person.id,
      name: person.name,
      score: person.score,
      percentage: questions.length ? Math.round((person.score / questions.length) * 100) : 0,
      answers: questions.map((_, index) => person.answers?.[index] ?? null),
    }))
    .sort((a, b) => b.score - a.score || b.percentage - a.percentage || a.name.localeCompare(b.name));
  const questionStats = questions.map((question, index) => {
    const answers = people.map((person) => person.answers?.[index]).filter((answer): answer is number => typeof answer === "number");
    const answerCounts = question.answers.map((_, answerIndex) => answers.filter((answer) => answer === answerIndex).length);
    const correct = answers.filter((answer) => answer === question.correctIndex).length;
    return { answered: answers.length, correct, accuracy: answers.length ? Math.round((correct / answers.length) * 100) : 0, answerCounts };
  });
  const totalAnswers = questionStats.reduce((sum, stat) => sum + stat.answered, 0);
  const correctAnswers = questionStats.reduce((sum, stat) => sum + stat.correct, 0);
  const scores = participants.map((person) => person.percentage);
  const sortedScores = [...scores].sort((a, b) => a - b);
  const medianPercentage = sortedScores.length
    ? sortedScores.length % 2
      ? sortedScores[Math.floor(sortedScores.length / 2)]
      : Math.round((sortedScores[sortedScores.length / 2 - 1] + sortedScores[sortedScores.length / 2]) / 2)
    : 0;
  const scoreDistribution = [
    { label: "0–24%", count: scores.filter((score) => score < 25).length },
    { label: "25–49%", count: scores.filter((score) => score >= 25 && score < 50).length },
    { label: "50–74%", count: scores.filter((score) => score >= 50 && score < 75).length },
    { label: "75–100%", count: scores.filter((score) => score >= 75).length },
  ];

  return res.json({
    code: row.code,
    quizTitle: quiz.title,
    questions: questions.map((question, index) => ({ index, prompt: question.prompt, answers: question.answers, correctIndex: question.correctIndex })),
    participants,
    questionStats,
    totalParticipants: participants.length,
    completedParticipants: people.filter((person) => (person.answers?.filter((answer) => typeof answer === "number").length ?? 0) >= questions.length).length,
    averagePercentage: scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0,
    highestPercentage: scores.length ? Math.max(...scores) : 0,
    lowestPercentage: scores.length ? Math.min(...scores) : 0,
    totalAnswers,
    correctAnswers,
    medianPercentage,
    scoreDistribution,
  });
});
router.post("/sessions/:code/answers", async (req, res) => {
  const { participantId, questionIndex, answerIndex } = req.body ?? {};
  const code = String(req.params.code).toUpperCase();
  const row = (await db.select().from(sessions).where(eq(sessions.code, code)).limit(1))[0];
  if (!row) return res.status(404).json({ error: "Session not found" });
  const quiz = (await db.select().from(quizzes).where(eq(quizzes.id, row.quizId)).limit(1))[0];
  const people = (row.participants as Array<{ id: string; name: string; answered: number; score: number; locked?: boolean }>) || [];
  const person = people.find(p => p.id === participantId);
  const questions = quiz.questions as Array<{ correctIndex: number }>;
  if (row.status !== "LIVE" || Number(questionIndex) !== (row.currentQuestion ?? 0) || !person || !questions[questionIndex]) return res.status(400).json({ error: "This question is not accepting answers." });
  if (person.locked) return res.status(403).json({ code: "PARTICIPANT_LOCKED", error: "Your answers are temporarily locked by the moderator." });
  if (quiz.timeLimitSeconds && row.questionStartedAt && Date.now() >= row.questionStartedAt.getTime() + quiz.timeLimitSeconds * 1000) return res.status(400).json({ error: "Time is up for this question." });
  const participantWithAnswers = person as typeof person & { answers?: number[] };
  if (participantWithAnswers.answers?.[Number(questionIndex)] !== undefined) return res.status(400).json({ error: "This question has already been answered." });
  person.answered = Math.max(person.answered, Number(questionIndex) + 1);
  if (Number(answerIndex) === questions[questionIndex].correctIndex) person.score += 1;
  participantWithAnswers.answers = [...(participantWithAnswers.answers ?? [])];
  participantWithAnswers.answers[Number(questionIndex)] = Number(answerIndex);
  await db.update(sessions).set({ participants: people }).where(eq(sessions.code, row.code));
  await autoAdvanceSession({ ...row, participants: people }, quiz);
  return res.json({ ...person, percentage: Math.round((person.score / questions.length) * 100) });
});

export default router;