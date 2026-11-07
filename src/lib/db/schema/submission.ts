import { boolean, index, integer, jsonb, numeric, pgTable, real, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { assignmentQuestions, assignments } from "./academic";
import { studentProfiles } from "./family";
import {
  accuracyLevelEnum,
  evaluationStatusEnum,
  finalAnswerStatusEnum,
  questionResultEnum,
  stepStatusEnum,
  uploadPurposeEnum,
  uploadStatusEnum,
} from "./enums";

/** Every object written to storage starts here (pending until verified). */
export const uploads = pgTable(
  "uploads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    familyId: uuid("family_id").notNull(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    purpose: uploadPurposeEnum("purpose").notNull(),
    storageKey: text("storage_key").notNull().unique(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    declaredSize: integer("declared_size").notNull(),
    sizeBytes: integer("size_bytes"),
    status: uploadStatusEnum("status").notNull().default("PENDING"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
  },
  (t) => [index("uploads_owner_status_idx").on(t.ownerUserId, t.status)],
);

export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    studentProfileId: uuid("student_profile_id")
      .notNull()
      .references(() => studentProfiles.id, { onDelete: "cascade" }),
    familyId: uuid("family_id").notNull(),
    attemptNumber: integer("attempt_number").notNull().default(1),
    /** Client-supplied key; retried requests return the original submission. */
    idempotencyKey: text("idempotency_key").notNull().unique(),
    notes: text("notes"),
    status: evaluationStatusEnum("status").notNull().default("UPLOADED"),
    isLate: boolean("is_late").notNull().default(false),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("submissions_attempt_uq").on(t.assignmentId, t.studentProfileId, t.attemptNumber),
    index("submissions_student_idx").on(t.studentProfileId, t.submittedAt),
    index("submissions_family_idx").on(t.familyId),
  ],
);

export const submissionFiles = pgTable(
  "submission_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    uploadId: uuid("upload_id")
      .notNull()
      .unique()
      .references(() => uploads.id),
    storageKey: text("storage_key").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    pageOrder: integer("page_order").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("submission_files_submission_idx").on(t.submissionId)],
);

export const evaluationJobs = pgTable(
  "evaluation_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    /** `${submissionId}:v${version}` — prevents duplicate jobs on retries. */
    jobKey: text("job_key").notNull().unique(),
    version: integer("version").notNull().default(1),
    status: evaluationStatusEnum("status").notNull().default("QUEUED"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(4),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }).notNull().defaultNow(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedBy: text("locked_by"),
    lastError: text("last_error"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("evaluation_jobs_status_next_idx").on(t.status, t.nextRunAt)],
);

export const evaluations = pgTable(
  "evaluations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    jobId: uuid("job_id").references(() => evaluationJobs.id, { onDelete: "set null" }),
    version: integer("version").notNull().default(1),
    isCurrent: boolean("is_current").notNull().default(true),
    /** AI score as originally produced — never modified by corrections. */
    aiScore: numeric("ai_score", { precision: 7, scale: 2, mode: "number" }).notNull(),
    /** Current score including parent corrections. */
    score: numeric("score", { precision: 7, scale: 2, mode: "number" }).notNull(),
    maxScore: numeric("max_score", { precision: 7, scale: 2, mode: "number" }).notNull(),
    summary: text("summary").notNull().default(""),
    strengths: jsonb("strengths").$type<string[]>().notNull().default([]),
    needsAttention: jsonb("needs_attention").$type<string[]>().notNull().default([]),
    suggestedPractice: jsonb("suggested_practice").$type<string[]>().notNull().default([]),
    confidence: real("confidence").notNull().default(0),
    needsReview: boolean("needs_review").notNull().default(false),
    reviewReasons: jsonb("review_reasons").$type<string[]>().notNull().default([]),
    /** Validated stage-1 extraction output, kept for the audit trail. */
    extraction: jsonb("extraction"),
    model: text("model").notNull(),
    promptVersion: text("prompt_version").notNull(),
    xpAwarded: integer("xp_awarded").notNull().default(0),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("evaluations_submission_version_uq").on(t.submissionId, t.version), index("evaluations_submission_idx").on(t.submissionId)],
);

export interface QuestionFeedback {
  whatWentWrong: string;
  whyIncorrect: string;
  correctApproach: string;
  howToAvoid: string;
  example: string;
}

export interface VerificationResult {
  method: "deterministic" | "not_applicable";
  expectedMatches?: boolean | null;
  finalAnswerCorrect?: boolean | null;
  stepChecks?: { step: string; valid: boolean | null }[];
  disagreement: boolean;
  note?: string;
}

export const questionEvaluations = pgTable(
  "question_evaluations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    evaluationId: uuid("evaluation_id")
      .notNull()
      .references(() => evaluations.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => assignmentQuestions.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    extractedAnswer: text("extracted_answer").notNull().default(""),
    extractedSteps: jsonb("extracted_steps").$type<string[]>().notNull().default([]),
    expectedAnswer: text("expected_answer").notNull(),
    maxMarks: numeric("max_marks", { precision: 6, scale: 2, mode: "number" }).notNull(),
    aiMarks: numeric("ai_marks", { precision: 6, scale: 2, mode: "number" }).notNull(),
    awardedMarks: numeric("awarded_marks", { precision: 6, scale: 2, mode: "number" }).notNull(),
    result: questionResultEnum("result").notNull(),
    conceptAccuracy: accuracyLevelEnum("concept_accuracy").notNull(),
    calculationAccuracy: accuracyLevelEnum("calculation_accuracy").notNull(),
    finalAnswerStatus: finalAnswerStatusEnum("final_answer_status").notNull(),
    mistakeTypes: jsonb("mistake_types").$type<string[]>().notNull().default([]),
    mistakeDescription: text("mistake_description"),
    explanation: text("explanation").notNull().default(""),
    feedback: jsonb("feedback").$type<QuestionFeedback | null>(),
    recommendedPractice: jsonb("recommended_practice").$type<string[]>().notNull().default([]),
    confidence: real("confidence").notNull().default(0),
    needsReview: boolean("needs_review").notNull().default(false),
    verification: jsonb("verification").$type<VerificationResult | null>(),
  },
  (t) => [uniqueIndex("question_evaluations_uq").on(t.evaluationId, t.questionId)],
);

export const evaluationSteps = pgTable(
  "evaluation_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    questionEvaluationId: uuid("question_evaluation_id")
      .notNull()
      .references(() => questionEvaluations.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    description: text("description").notNull(),
    awardedMarks: numeric("awarded_marks", { precision: 6, scale: 2, mode: "number" }).notNull(),
    maxMarks: numeric("max_marks", { precision: 6, scale: 2, mode: "number" }).notNull(),
    status: stepStatusEnum("status").notNull(),
    comment: text("comment"),
  },
  (t) => [index("evaluation_steps_qe_idx").on(t.questionEvaluationId)],
);

/** Parent corrections are stored separately; AI results are never overwritten. */
export const evaluationCorrections = pgTable(
  "evaluation_corrections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    evaluationId: uuid("evaluation_id")
      .notNull()
      .references(() => evaluations.id, { onDelete: "cascade" }),
    questionEvaluationId: uuid("question_evaluation_id")
      .notNull()
      .references(() => questionEvaluations.id, { onDelete: "cascade" }),
    correctedBy: uuid("corrected_by")
      .notNull()
      .references(() => users.id),
    previousMarks: numeric("previous_marks", { precision: 6, scale: 2, mode: "number" }).notNull(),
    newMarks: numeric("new_marks", { precision: 6, scale: 2, mode: "number" }).notNull(),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("evaluation_corrections_eval_idx").on(t.evaluationId)],
);
