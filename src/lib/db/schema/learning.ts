import { boolean, date, index, integer, jsonb, pgTable, real, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { topics, subjects } from "./academic";
import { studentProfiles } from "./family";
import { evaluations, questionEvaluations } from "./submission";
import {
  activityTypeEnum,
  difficultyEnum,
  masteryLevelEnum,
  mistakeStatusEnum,
  practiceModeEnum,
  practiceStatusEnum,
} from "./enums";

export const practiceSessions = pgTable(
  "practice_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentProfileId: uuid("student_profile_id")
      .notNull()
      .references(() => studentProfiles.id, { onDelete: "cascade" }),
    familyId: uuid("family_id").notNull(),
    mode: practiceModeEnum("mode").notNull(),
    title: text("title").notNull(),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id),
    topicId: uuid("topic_id").references(() => topics.id),
    difficulty: difficultyEnum("difficulty").notNull(),
    status: practiceStatusEnum("status").notNull().default("ACTIVE"),
    generatedBy: text("generated_by").notNull().default("bank"),
    sourceEvaluationId: uuid("source_evaluation_id").references(() => evaluations.id, { onDelete: "set null" }),
    questionCount: integer("question_count").notNull(),
    correctCount: integer("correct_count").notNull().default(0),
    xpAwarded: integer("xp_awarded").notNull().default(0),
    timeSpentSeconds: integer("time_spent_seconds").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("practice_sessions_student_idx").on(t.studentProfileId, t.startedAt)],
);

export const practiceQuestions = pgTable(
  "practice_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => practiceSessions.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    topicId: uuid("topic_id").references(() => topics.id),
    difficulty: difficultyEnum("difficulty").notNull(),
    questionText: text("question_text").notNull(),
    answer: text("answer").notNull(),
    acceptedAnswers: jsonb("accepted_answers").$type<string[]>().notNull().default([]),
    solution: text("solution").notNull().default(""),
    hint: text("hint").notNull().default(""),
    marks: integer("marks").notNull().default(1),
    mistakeId: uuid("mistake_id"),
  },
  (t) => [uniqueIndex("practice_questions_position_uq").on(t.sessionId, t.position)],
);

export const practiceAnswers = pgTable("practice_answers", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => practiceSessions.id, { onDelete: "cascade" }),
  questionId: uuid("question_id")
    .notNull()
    .unique()
    .references(() => practiceQuestions.id, { onDelete: "cascade" }),
  answer: text("answer").notNull(),
  steps: jsonb("steps").$type<string[]>().notNull().default([]),
  isCorrect: boolean("is_correct").notNull(),
  verificationMethod: text("verification_method").notNull(),
  timeSpentSeconds: integer("time_spent_seconds").notNull().default(0),
  answeredAt: timestamp("answered_at", { withTimezone: true }).notNull().defaultNow(),
});

export const topicProgress = pgTable(
  "topic_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentProfileId: uuid("student_profile_id")
      .notNull()
      .references(() => studentProfiles.id, { onDelete: "cascade" }),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    totalAttempts: integer("total_attempts").notNull().default(0),
    correctAttempts: integer("correct_attempts").notNull().default(0),
    accuracy: real("accuracy").notNull().default(0),
    averageMarksPct: real("average_marks_pct").notNull().default(0),
    /** Most recent 10 scores (0-100), newest last. */
    recentScores: jsonb("recent_scores").$type<number[]>().notNull().default([]),
    masteryScore: real("mastery_score").notNull().default(0),
    masteryLevel: masteryLevelEnum("mastery_level").notNull().default("NOT_STARTED"),
    previousMasteryScore: real("previous_mastery_score").notNull().default(0),
    repeatedErrors: jsonb("repeated_errors").$type<Record<string, number>>().notNull().default({}),
    revisionCount: integer("revision_count").notNull().default(0),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("topic_progress_uq").on(t.studentProfileId, t.topicId)],
);

export const mistakeNotebook = pgTable(
  "mistake_notebook",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentProfileId: uuid("student_profile_id")
      .notNull()
      .references(() => studentProfiles.id, { onDelete: "cascade" }),
    topicId: uuid("topic_id").references(() => topics.id),
    questionEvaluationId: uuid("question_evaluation_id")
      .unique()
      .references(() => questionEvaluations.id, { onDelete: "set null" }),
    questionText: text("question_text").notNull(),
    studentAnswer: text("student_answer").notNull().default(""),
    expectedAnswer: text("expected_answer").notNull(),
    mistakeType: text("mistake_type"),
    explanation: text("explanation").notNull().default(""),
    status: mistakeStatusEnum("status").notNull().default("OPEN"),
    attempts: integer("attempts").notNull().default(0),
    correctedAt: timestamp("corrected_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("mistake_notebook_student_status_idx").on(t.studentProfileId, t.status)],
);

export const revisionSessions = pgTable("revision_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentProfileId: uuid("student_profile_id")
    .notNull()
    .references(() => studentProfiles.id, { onDelete: "cascade" }),
  practiceSessionId: uuid("practice_session_id").references(() => practiceSessions.id, { onDelete: "set null" }),
  topicId: uuid("topic_id").references(() => topics.id),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("PLANNED"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const learningActivityLogs = pgTable(
  "learning_activity_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentProfileId: uuid("student_profile_id")
      .notNull()
      .references(() => studentProfiles.id, { onDelete: "cascade" }),
    familyId: uuid("family_id").notNull(),
    activityType: activityTypeEnum("activity_type").notNull(),
    sourceType: text("source_type").notNull(),
    sourceId: uuid("source_id").notNull(),
    /** Calendar day in the family's timezone — drives streaks. */
    localDate: date("local_date", { mode: "string" }).notNull(),
    minutes: integer("minutes").notNull().default(0),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("learning_activity_source_uq").on(t.activityType, t.sourceType, t.sourceId),
    index("learning_activity_student_date_idx").on(t.studentProfileId, t.localDate),
  ],
);

export const dailyGoals = pgTable(
  "daily_goals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentProfileId: uuid("student_profile_id")
      .notNull()
      .references(() => studentProfiles.id, { onDelete: "cascade" }),
    localDate: date("local_date", { mode: "string" }).notNull(),
    targetMinutes: integer("target_minutes").notNull(),
    achievedMinutes: integer("achieved_minutes").notNull().default(0),
    completed: boolean("completed").notNull().default(false),
  },
  (t) => [uniqueIndex("daily_goals_uq").on(t.studentProfileId, t.localDate)],
);

