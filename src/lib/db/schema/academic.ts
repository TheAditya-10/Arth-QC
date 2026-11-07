import { boolean, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { assignmentSourceEnum, assignmentStatusEnum, difficultyEnum, rubricSourceEnum } from "./enums";

export const subjects = pgTable("subjects", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const curricula = pgTable("curriculum", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  board: text("board").notNull(),
  country: text("country").notNull().default("IN"),
});

export const topics = pgTable(
  "topics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    curriculumId: uuid("curriculum_id").references(() => curricula.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    grade: integer("grade").notNull(),
    chapter: integer("chapter").notNull().default(0),
  },
  (t) => [uniqueIndex("topics_subject_code_grade_uq").on(t.subjectId, t.code, t.grade)],
);

export interface MarkingConfig {
  markingScheme?: string;
  allowAlternativeMethods: boolean;
  /** Award method marks even when the final answer is wrong. */
  partialCredit: boolean;
}

export const assignments = pgTable(
  "assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    familyId: uuid("family_id").notNull(),
    studentProfileId: uuid("student_profile_id").notNull(),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id),
    grade: integer("grade").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    instructions: jsonb("instructions").$type<string[]>().notNull().default([]),
    difficulty: difficultyEnum("difficulty").notNull().default("MEDIUM"),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    totalMarks: integer("total_marks").notNull(),
    estimatedMinutes: integer("estimated_minutes").notNull().default(30),
    source: assignmentSourceEnum("source").notNull().default("PARENT"),
    status: assignmentStatusEnum("status").notNull().default("PUBLISHED"),
    markingConfig: jsonb("marking_config").$type<MarkingConfig>().notNull().default({ allowAlternativeMethods: true, partialCredit: true }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    /** Student-side progress marker (opened/started). */
    startedAt: timestamp("started_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [index("assignments_student_due_idx").on(t.studentProfileId, t.dueAt), index("assignments_family_idx").on(t.familyId)],
);

export const assignmentQuestions = pgTable(
  "assignment_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    questionText: text("question_text").notNull(),
    expectedAnswer: text("expected_answer").notNull(),
    expectedSolution: text("expected_solution"),
    maxMarks: numeric("max_marks", { precision: 6, scale: 2, mode: "number" }).notNull(),
    difficulty: difficultyEnum("difficulty").notNull().default("MEDIUM"),
    topicId: uuid("topic_id").references(() => topics.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("assignment_questions_position_uq").on(t.assignmentId, t.position)],
);

export interface RubricStep {
  description: string;
  marks: number;
}

export const markingRubrics = pgTable(
  "marking_rubrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => assignmentQuestions.id, { onDelete: "cascade" }),
    source: rubricSourceEnum("source").notNull(),
    version: integer("version").notNull().default(1),
    steps: jsonb("steps").$type<RubricStep[]>().notNull(),
    alternativeMethods: jsonb("alternative_methods").$type<string[]>().notNull().default([]),
    expectedSolution: text("expected_solution"),
    totalMarks: numeric("total_marks", { precision: 6, scale: 2, mode: "number" }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    model: text("model"),
    promptVersion: text("prompt_version"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("marking_rubrics_question_version_uq").on(t.questionId, t.version)],
);

export const assignmentAttachments = pgTable(
  "assignment_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    uploadId: uuid("upload_id").notNull(),
    storageKey: text("storage_key").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("assignment_attachments_assignment_idx").on(t.assignmentId)],
);
