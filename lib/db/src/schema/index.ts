import { boolean, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("quiz_users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull(),
  status: text("status").notNull().default("ACTIVE"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const applications = pgTable("teacher_applications", {
  id: text("id").primaryKey(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  organization: text("organization").notNull(),
  reason: text("reason").notNull(),
  phone: text("phone"),
  applicantRole: text("applicant_role"),
  status: text("status").notNull().default("PENDING"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const registrationKeys = pgTable("teacher_registration_keys", {
  id: text("id").primaryKey(),
  applicationId: text("application_id").notNull().unique(),
  keyHash: text("key_hash").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
});

export const quizzes = pgTable("quizzes", {
  id: text("id").primaryKey(),
  teacherId: text("teacher_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  timeLimitSeconds: integer("time_limit_seconds"),
  questions: jsonb("questions").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const sessions = pgTable("quiz_sessions", {
  code: text("code").primaryKey(),
  quizId: text("quiz_id").notNull(),
  teacherId: text("teacher_id").notNull(),
  status: text("status").notNull().default("LOBBY"),
  currentQuestion: integer("current_question").default(0),
  questionStartedAt: timestamp("question_started_at"),
  participants: jsonb("participants").notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});