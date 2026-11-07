import { boolean, date, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { families, studentProfiles } from "./family";
import { chatRoleEnum, emailStatusEnum, reportStatusEnum } from "./enums";
import type { WeeklyReportData } from "@/lib/services/report.types";

export const weeklyReports = pgTable(
  "weekly_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentProfileId: uuid("student_profile_id")
      .notNull()
      .references(() => studentProfiles.id, { onDelete: "cascade" }),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    weekStart: date("week_start", { mode: "string" }).notNull(),
    weekEnd: date("week_end", { mode: "string" }).notNull(),
    timezone: text("timezone").notNull(),
    data: jsonb("data").$type<WeeklyReportData>().notNull(),
    status: reportStatusEnum("status").notNull().default("GENERATED"),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("weekly_reports_student_week_uq").on(t.studentProfileId, t.weekStart)],
);

export const reportRecipients = pgTable(
  "report_recipients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("report_recipients_family_email_uq").on(t.familyId, t.email)],
);

export interface AppPreferencesData {
  soundEffects: boolean;
  showMotivation: boolean;
  celebrations: boolean;
  aiHintLevel: "gentle" | "standard" | "detailed";
}

export const notificationPreferences = pgTable("notification_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  submissionEvaluated: boolean("submission_evaluated").notNull().default(true),
  deadlineReminders: boolean("deadline_reminders").notNull().default(true),
  streakAlerts: boolean("streak_alerts").notNull().default(true),
  achievementUnlocked: boolean("achievement_unlocked").notNull().default(true),
  weakTopicAlerts: boolean("weak_topic_alerts").notNull().default(false),
  appPreferences: jsonb("app_preferences")
    .$type<AppPreferencesData>()
    .notNull()
    .default({ soundEffects: true, showMotivation: true, celebrations: true, aiHintLevel: "gentle" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const emailDeliveryLogs = pgTable(
  "email_delivery_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    familyId: uuid("family_id").references(() => families.id, { onDelete: "cascade" }),
    weeklyReportId: uuid("weekly_report_id").references(() => weeklyReports.id, { onDelete: "cascade" }),
    template: text("template").notNull(),
    recipientEmail: text("recipient_email").notNull(),
    subject: text("subject").notNull(),
    providerMessageId: text("provider_message_id"),
    status: emailStatusEnum("status").notNull().default("QUEUED"),
    error: text("error"),
    attempts: integer("attempts").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("email_delivery_report_recipient_uq").on(t.weeklyReportId, t.recipientEmail),
    index("email_delivery_family_idx").on(t.familyId, t.createdAt),
  ],
);

// ---- AI Buddy chat (retention-limited) ----
export const buddyMessages = pgTable(
  "buddy_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentProfileId: uuid("student_profile_id")
      .notNull()
      .references(() => studentProfiles.id, { onDelete: "cascade" }),
    role: chatRoleEnum("role").notNull(),
    content: text("content").notNull(),
    model: text("model"),
    flagged: boolean("flagged").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("buddy_messages_student_idx").on(t.studentProfileId, t.createdAt)],
);

// ---- Operational tables ----
/** Fixed-window rate limiting for our own API routes (works across serverless instances). */
export const apiRateLimits = pgTable("api_rate_limits", {
  key: text("key").primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  count: integer("count").notNull().default(0),
});

export const aiUsageLogs = pgTable(
  "ai_usage_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    purpose: text("purpose").notNull(),
    model: text("model").notNull(),
    promptVersion: text("prompt_version").notNull(),
    status: text("status").notNull(),
    latencyMs: integer("latency_ms").notNull().default(0),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    error: text("error"),
    referenceId: text("reference_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ai_usage_logs_created_idx").on(t.createdAt)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    familyId: uuid("family_id"),
    actorUserId: uuid("actor_user_id"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_logs_family_idx").on(t.familyId, t.createdAt)],
);
