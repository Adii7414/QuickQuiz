import { Router, type IRouter, type Request, type Response } from "express";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { and, desc, eq, ilike, isNull, or } from "drizzle-orm";
import { db, applications, quizzes, registrationKeys, sessions, users } from "@workspace/db";

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
function issue(res: Response, user: { id: string; name: string; email: string; role: string }) {
  const token = randomBytes(32).toString("hex");
  auth.set(token, { userId: user.id, role: user.role });
  res.cookie("quiz_session", token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 1000 * 60 * 60 * 12 });
  return res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
}
function publicApplication(row: typeof applications.$inferSelect) {
  return { id: row.id, fullName: row.fullName, email: row.email, organization: row.organization, reason: row.reason, phone: row.phone, role: row.applicantRole, status: row.status, submittedAt: row.createdAt.toISOString(), reviewedAt: row.reviewedAt?.toISOString() ?? null };
}
function publicQuiz(row: typeof quizzes.$inferSelect) {
  const questions = row.questions as Array<{ prompt: string; answers: string[]; correctIndex: number }>;
  return { id: row.id, title: row.title, description: row.description, questions, questionCount: questions.length, updatedAt: row.updatedAt.toISOString() };
}
function publicSession(row: typeof sessions.$inferSelect, quiz?: typeof quizzes.$inferSelect) {
  const people = (row.participants as Array<{ id: string; name: string; answered: number; score: number }>) || [];
  const q = quiz ? publicQuiz(quiz) : undefined;
  return { code: row.code, status: row.status, quizTitle: quiz?.title ?? "Quiz", participantCount: people.length, currentQuestion: row.currentQuestion ?? 0, participants: people.map(p => ({ ...p, percentage: q?.questionCount ? Math.round((p.score / q.questionCount) * 100) : 0 })), ...(q ? { quiz: q } : {}) };
}

router.post("/auth/teacher/login", async (req, res) => {
  const email = String(req.body?.email ?? "").toLowerCase();
  const password = String(req.body?.password ?? "");
  const rows = await db.select().from(users).where(and(eq(users.email, email), eq(users.role, "TEACHER"))).limit(1);
  if (!rows[0] || rows[0].status !== "ACTIVE" || !verify(password, rows[0].passwordHash)) return res.status(401).json({ error: "Invalid credentials" });
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
  return res.json({ id: row.id, name: row.name, email: row.email, role: row.role });
});
router.post("/applications", async (req, res) => {
  const { fullName, email, organization, reason, phone, role } = req.body ?? {};
  if (!fullName || !emailPattern.test(email) || !organization || String(reason).length < 10) return res.status(400).json({ error: "Please complete all required fields." });
  const id = `APP-${randomBytes(5).toString("hex").toUpperCase()}`;
  const row = (await db.insert(applications).values({ id, fullName, email: email.toLowerCase(), organization, reason, phone: phone || null, applicantRole: role || null }).returning())[0];
  return res.status(201).json({ id: row.id, status: row.status, submittedAt: row.createdAt.toISOString() });
});
router.get("/applications", requireRole("MODERATOR"), async (req, res) => {
  const search = String(req.query.search ?? "");
  const status = String(req.query.status ?? "");
  const filters = [];
  if (status && ["PENDING", "APPROVED", "REJECTED"].includes(status)) filters.push(eq(applications.status, status));
  if (search) filters.push(or(ilike(applications.fullName, `%${search}%`), ilike(applications.email, `%${search}%`), ilike(applications.organization, `%${search}%`)));
  const rows = await db.select().from(applications).where(filters.length ? and(...filters) : undefined).orderBy(desc(applications.createdAt));
  return res.json(rows.map(publicApplication));
});
router.get("/applications/:id", requireRole("MODERATOR"), async (req, res) => {
  const id = String(req.params.id);
  const row = (await db.select().from(applications).where(eq(applications.id, id)).limit(1))[0];
  return row ? res.json(publicApplication(row)) : res.status(404).json({ error: "Application not found" });
});
router.post("/applications/:id/decision", requireRole("MODERATOR"), async (req, res) => {
  const decision = req.body?.decision;
  if (!["APPROVED", "REJECTED"].includes(decision)) return res.status(400).json({ error: "Invalid decision" });
  const id = String(req.params.id);
  const row = (await db.select().from(applications).where(eq(applications.id, id)).limit(1))[0];
  if (!row) return res.status(404).json({ error: "Application not found" });
  const reviewedAt = new Date();
  const updated = (await db.update(applications).set({ status: decision, reviewedAt }).where(eq(applications.id, row.id)).returning())[0];
  if (decision === "REJECTED") return res.json({ application: publicApplication(updated), registrationKey: null, expiresAt: null });
  const raw = `TCH-${randomBytes(18).toString("base64url")}`;
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 72);
  await db.insert(registrationKeys).values({ id: randomUUID(), applicationId: row.id, keyHash: hash(raw), expiresAt: expires });
  return res.json({ application: publicApplication(updated), registrationKey: raw, expiresAt: expires.toISOString() });
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

router.get("/quizzes", requireRole("TEACHER"), async (req, res) => {
  const current = session(req)!;
  const rows = await db.select().from(quizzes).where(eq(quizzes.teacherId, current.userId)).orderBy(desc(quizzes.updatedAt));
  return res.json(rows.map(publicQuiz));
});
router.post("/quizzes", requireRole("TEACHER"), async (req, res) => {
  const current = session(req)!;
  const { title, description = "", questions = [] } = req.body ?? {};
  if (!title || !Array.isArray(questions) || questions.some((q: { answers?: string[] }) => !Array.isArray(q.answers) || q.answers.length !== 4)) return res.status(400).json({ error: "A quiz needs a title and exactly four answers per question." });
  const row = (await db.insert(quizzes).values({ id: randomUUID(), teacherId: current.userId, title, description, questions }).returning())[0];
  return res.status(201).json(publicQuiz(row));
});
router.patch("/quizzes/:id", requireRole("TEACHER"), async (req, res) => {
  const current = session(req)!;
  const { title, description = "", questions = [] } = req.body ?? {};
  const id = String(req.params.id);
  const row = (await db.update(quizzes).set({ title, description, questions, updatedAt: new Date() }).where(and(eq(quizzes.id, id), eq(quizzes.teacherId, current.userId))).returning())[0];
  return row ? res.json(publicQuiz(row)) : res.status(404).json({ error: "Quiz not found" });
});
router.delete("/quizzes/:id", requireRole("TEACHER"), async (req, res) => {
  const current = session(req)!;
  const id = String(req.params.id);
  await db.delete(quizzes).where(and(eq(quizzes.id, id), eq(quizzes.teacherId, current.userId)));
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
  return res.json(publicSession(row, quiz));
});
router.post("/sessions/:code", async (req, res) => {
  const code = String(req.params.code).toUpperCase();
  const row = (await db.select().from(sessions).where(eq(sessions.code, code)).limit(1))[0];
  if (!row || row.status !== "LOBBY") return res.status(400).json({ error: "This quiz is no longer accepting players." });
  const name = String(req.body?.name ?? "").trim();
  if (!name) return res.status(400).json({ error: "Enter your name." });
  const participant = { id: randomUUID(), name, answered: 0, score: 0 };
  const people = [...((row.participants as typeof participant[]) || []), participant];
  await db.update(sessions).set({ participants: people }).where(eq(sessions.code, code));
  return res.status(201).json({ ...participant, percentage: 0 });
});
router.post("/sessions/:code/start", requireRole("TEACHER"), async (req, res) => {
  const current = session(req)!;
  const code = String(req.params.code).toUpperCase();
  const row = (await db.update(sessions).set({ status: "LIVE" }).where(and(eq(sessions.code, code), eq(sessions.teacherId, current.userId))).returning())[0];
  if (!row) return res.status(404).json({ error: "Session not found" });
  const quiz = (await db.select().from(quizzes).where(eq(quizzes.id, row.quizId)).limit(1))[0];
  return res.json(publicSession(row, quiz));
});
router.post("/sessions/:code/answers", async (req, res) => {
  const { participantId, questionIndex, answerIndex } = req.body ?? {};
  const code = String(req.params.code).toUpperCase();
  const row = (await db.select().from(sessions).where(eq(sessions.code, code)).limit(1))[0];
  if (!row) return res.status(404).json({ error: "Session not found" });
  const quiz = (await db.select().from(quizzes).where(eq(quizzes.id, row.quizId)).limit(1))[0];
  const people = (row.participants as Array<{ id: string; name: string; answered: number; score: number }>) || [];
  const person = people.find(p => p.id === participantId);
  const questions = quiz.questions as Array<{ correctIndex: number }>;
  if (!person || !questions[questionIndex]) return res.status(400).json({ error: "Invalid answer." });
  person.answered = Math.max(person.answered, Number(questionIndex) + 1);
  if (Number(answerIndex) === questions[questionIndex].correctIndex) person.score += 1;
  await db.update(sessions).set({ participants: people }).where(eq(sessions.code, row.code));
  return res.json({ ...person, percentage: Math.round((person.score / questions.length) * 100) });
});

export default router;