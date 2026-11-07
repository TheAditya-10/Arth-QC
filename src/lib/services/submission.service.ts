import "server-only";
import { and, count, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { AppError, conflict, notFound } from "@/lib/security/errors";
import { assertStudentAccess, type Actor } from "@/lib/security/actor";
import { MAX_FILES_PER_SUBMISSION, deleteObjects } from "@/lib/storage/upload.service";
import { enqueueEvaluation, requeueEvaluation } from "./evaluation.service";
import { afterProgress, awardXp, familyContext, scoreBonusRule, pct } from "./gamification";
import { audit } from "./audit.service";

export const MAX_ATTEMPTS_PER_ASSIGNMENT = 3;

export const createSubmissionSchema = z.object({
  assignmentId: z.string().uuid(),
  uploadIds: z.array(z.string().uuid()).min(1).max(MAX_FILES_PER_SUBMISSION),
  notes: z.string().trim().max(300).optional(),
  idempotencyKey: z.string().min(16).max(100),
});

/**
 * Finalises a homework submission and queues it for evaluation. Files are only sent
 * to the AI after this point. Retried requests (same idempotency key) return the
 * original submission instead of creating a duplicate.
 */
export async function createSubmission(actor: Actor & { studentProfileId: string }, input: z.infer<typeof createSubmissionSchema>) {
  const d = db();
  const [existing] = await d.select().from(schema.submissions).where(eq(schema.submissions.idempotencyKey, input.idempotencyKey));
  if (existing) {
    if (existing.studentProfileId !== actor.studentProfileId) throw conflict("Duplicate request key.");
    const [job] = await d.select({ id: schema.evaluationJobs.id }).from(schema.evaluationJobs).where(eq(schema.evaluationJobs.submissionId, existing.id));
    return { submissionId: existing.id, jobId: job?.id ?? null, duplicate: true };
  }

  const [a] = await d
    .select()
    .from(schema.assignments)
    .where(and(eq(schema.assignments.id, input.assignmentId), isNull(schema.assignments.deletedAt), eq(schema.assignments.status, "PUBLISHED")));
  if (!a || a.studentProfileId !== actor.studentProfileId) throw notFound("Assignment");

  const prior = await d
    .select({ id: schema.submissions.id, status: schema.submissions.status })
    .from(schema.submissions)
    .where(and(eq(schema.submissions.assignmentId, a.id), eq(schema.submissions.studentProfileId, actor.studentProfileId), isNull(schema.submissions.deletedAt)));
  if (prior.some((p) => !["COMPLETED", "NEEDS_REVIEW", "FAILED"].includes(p.status))) throw conflict("Your previous submission is still being checked.");
  if (prior.length >= MAX_ATTEMPTS_PER_ASSIGNMENT) throw conflict("You've reached the maximum number of attempts for this assignment.");

  const uploads = await d.select().from(schema.uploads).where(inArray(schema.uploads.id, input.uploadIds));
  for (const id of input.uploadIds) {
    const u = uploads.find((x) => x.id === id);
    if (!u || u.ownerUserId !== actor.userId || u.purpose !== "SUBMISSION" || u.status !== "UPLOADED") {
      throw new AppError("VALIDATION", "One of the files is missing or wasn't uploaded completely. Please re-add it.");
    }
  }

  return d.transaction(async (tx) => {
    const [{ n }] = await tx
      .select({ n: count() })
      .from(schema.submissions)
      .where(and(eq(schema.submissions.assignmentId, a.id), eq(schema.submissions.studentProfileId, actor.studentProfileId)));
    const [sub] = await tx
      .insert(schema.submissions)
      .values({
        assignmentId: a.id,
        studentProfileId: actor.studentProfileId,
        familyId: actor.familyId,
        attemptNumber: n + 1,
        idempotencyKey: input.idempotencyKey,
        notes: input.notes || null,
        isLate: new Date() > a.dueAt,
        status: "UPLOADED",
      })
      .returning();
    await tx.insert(schema.submissionFiles).values(
      input.uploadIds.map((id, i) => {
        const u = uploads.find((x) => x.id === id)!;
        return { submissionId: sub.id, uploadId: u.id, storageKey: u.storageKey, fileName: u.fileName, mimeType: u.mimeType, sizeBytes: u.sizeBytes ?? u.declaredSize, pageOrder: i + 1 };
      }),
    );
    await tx.update(schema.uploads).set({ status: "ATTACHED" }).where(inArray(schema.uploads.id, input.uploadIds));
    const job = await enqueueEvaluation(tx, sub.id, 1);
    return { submissionId: sub.id, jobId: job.id, duplicate: false };
  });
}

async function loadSubmission(actor: Actor, id: string) {
  const [s] = await db().select().from(schema.submissions).where(and(eq(schema.submissions.id, id), isNull(schema.submissions.deletedAt)));
  if (!s || s.familyId !== actor.familyId) throw notFound("Submission");
  await assertStudentAccess(actor, s.studentProfileId);
  return s;
}

const STAGE_INDEX: Record<string, number> = { UPLOADED: 0, QUEUED: 0, PROCESSING: 0, EXTRACTING: 1, EVALUATING: 2, COMPLETED: 4, NEEDS_REVIEW: 4, FAILED: -1 };

/** Lightweight status for the processing screen (polled). */
export async function submissionStatus(actor: Actor, id: string) {
  const s = await loadSubmission(actor, id);
  const [job] = await db().select().from(schema.evaluationJobs).where(eq(schema.evaluationJobs.submissionId, id)).orderBy(schema.evaluationJobs.version);
  return {
    submissionId: s.id,
    status: s.status,
    stage: STAGE_INDEX[s.status] ?? 0,
    done: ["COMPLETED", "NEEDS_REVIEW", "FAILED"].includes(s.status),
    attempts: job?.attempts ?? 0,
    retrying: s.status === "QUEUED" && (job?.attempts ?? 0) > 0,
    nextRunAt: job?.nextRunAt?.toISOString() ?? null,
    jobId: job?.id ?? null,
    // Internal error details are only shown to parents.
    error: actor.role === "PARENT" ? job?.lastError ?? null : null,
  };
}

export const correctionSchema = z.object({
  corrections: z
    .array(z.object({ questionEvaluationId: z.string().uuid(), newMarks: z.coerce.number().min(0) }))
    .max(50),
  reason: z.string().trim().min(3, "Please give a reason for the correction").max(500),
});

/**
 * Parent correction. AI marks (ai_marks / ai_score) are never modified; each change
 * is recorded in evaluation_corrections with the reason.
 */
export async function correctEvaluation(actor: Actor, submissionId: string, input: z.infer<typeof correctionSchema>) {
  const s = await loadSubmission(actor, submissionId);
  const d = db();
  const [ev] = await d.select().from(schema.evaluations).where(and(eq(schema.evaluations.submissionId, s.id), eq(schema.evaluations.isCurrent, true)));
  if (!ev) throw notFound("Evaluation");
  return d.transaction(async (tx) => {
    const qes = await tx.select().from(schema.questionEvaluations).where(eq(schema.questionEvaluations.evaluationId, ev.id));
    for (const c of input.corrections) {
      const qe = qes.find((q) => q.id === c.questionEvaluationId);
      if (!qe) throw notFound("Question");
      if (c.newMarks > qe.maxMarks) throw new AppError("VALIDATION", `Marks for Q${qe.position} can't exceed ${qe.maxMarks}.`);
      if (Math.abs(c.newMarks - qe.awardedMarks) < 0.001) continue;
      await tx.insert(schema.evaluationCorrections).values({
        evaluationId: ev.id,
        questionEvaluationId: qe.id,
        correctedBy: actor.userId,
        previousMarks: qe.awardedMarks,
        newMarks: c.newMarks,
        reason: input.reason,
      });
      const result = c.newMarks >= qe.maxMarks ? "CORRECT" : c.newMarks <= 0 ? (qe.finalAnswerStatus === "MISSING" ? "UNANSWERED" : "INCORRECT") : "PARTIAL";
      await tx.update(schema.questionEvaluations).set({ awardedMarks: c.newMarks, result, needsReview: false }).where(eq(schema.questionEvaluations.id, qe.id));
      qe.awardedMarks = c.newMarks;
    }
    const score = Math.round(qes.reduce((sum, q) => sum + q.awardedMarks, 0) * 100) / 100;
    await tx.update(schema.evaluations).set({ score, needsReview: false, reviewedAt: new Date(), reviewedBy: actor.userId }).where(eq(schema.evaluations.id, ev.id));
    await tx.update(schema.submissions).set({ status: "COMPLETED" }).where(eq(schema.submissions.id, s.id));
    await tx.update(schema.evaluationJobs).set({ status: "COMPLETED" }).where(and(eq(schema.evaluationJobs.submissionId, s.id), eq(schema.evaluationJobs.status, "NEEDS_REVIEW")));

    // Score bonuses held back during review are released now (still idempotent per assignment).
    const fam = await familyContext(tx, s.studentProfileId);
    const [a] = await tx.select({ title: schema.assignments.title }).from(schema.assignments).where(eq(schema.assignments.id, s.assignmentId));
    const bonus = scoreBonusRule(pct(score, ev.maxScore));
    if (bonus) {
      await awardXp(tx, { studentProfileId: s.studentProfileId, ruleKey: bonus, amount: fam.rules[bonus], sourceType: "assignment", sourceId: s.assignmentId, description: `Scored ${Math.round(pct(score, ev.maxScore))}% on ${a?.title ?? "homework"}` });
    }
    await afterProgress(tx, s.studentProfileId, fam.timezone);
    await audit(tx, { familyId: actor.familyId, actorUserId: actor.userId, action: "evaluation.corrected", entityType: "evaluation", entityId: ev.id, details: { reason: input.reason, changes: input.corrections.length } });
    return { score, maxScore: ev.maxScore };
  });
}

/** Retry a failed evaluation, or re-evaluate a completed one as a new version. */
export async function retryEvaluation(actor: Actor, submissionId: string, newVersion: boolean) {
  const s = await loadSubmission(actor, submissionId);
  if (!newVersion && s.status !== "FAILED") throw conflict("Only failed evaluations can be retried.");
  const job = await requeueEvaluation(s.id, { newVersion });
  await audit(db(), { familyId: actor.familyId, actorUserId: actor.userId, action: newVersion ? "evaluation.reevaluate" : "evaluation.retry", entityType: "submission", entityId: s.id });
  return { jobId: job.id };
}

/** Deletes a submission and its stored notebook files (data retention). */
export async function deleteSubmission(actor: Actor, submissionId: string) {
  const s = await loadSubmission(actor, submissionId);
  const d = db();
  const files = await d.select({ key: schema.submissionFiles.storageKey, uploadId: schema.submissionFiles.uploadId }).from(schema.submissionFiles).where(eq(schema.submissionFiles.submissionId, s.id));
  await d.transaction(async (tx) => {
    await tx.update(schema.submissions).set({ deletedAt: new Date() }).where(eq(schema.submissions.id, s.id));
    if (files.length) await tx.update(schema.uploads).set({ status: "DELETED" }).where(inArray(schema.uploads.id, files.map((f) => f.uploadId)));
    await audit(tx, { familyId: actor.familyId, actorUserId: actor.userId, action: "submission.deleted", entityType: "submission", entityId: s.id });
  });
  await deleteObjects(files.map((f) => f.key));
}
