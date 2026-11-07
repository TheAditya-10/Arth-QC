import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, lte, sql } from "drizzle-orm";
import { db, schema, type Tx } from "@/lib/db";
import { env } from "@/lib/env";
import { storage } from "@/lib/storage";
import { AIError } from "@/lib/ai/provider";
import { extractHandwriting } from "@/lib/ai/extraction.service";
import { establishRubrics } from "@/lib/ai/rubric.service";
import { gradeAnswers } from "@/lib/ai/evaluation.service";
import { generateFeedback } from "@/lib/ai/feedback.service";
import { finalQuestionResultSchema } from "@/lib/ai/schemas";
import { PROMPT_VERSIONS } from "@/lib/ai/prompts";
import type { EvalContext } from "@/lib/ai/types";
import { afterProgress, awardXp, familyContext, recordActivity, scoreBonusRule, pct } from "./gamification";
import { recordTopicAttempt } from "./progress";

const LOCK_TIMEOUT_MS = 10 * 60_000;
type Status = (typeof schema.evaluationStatusEnum.enumValues)[number];

async function setStatus(jobId: string, submissionId: string, status: Status) {
  const d = db();
  await d.update(schema.evaluationJobs).set({ status, updatedAt: new Date() }).where(eq(schema.evaluationJobs.id, jobId));
  await d.update(schema.submissions).set({ status }).where(eq(schema.submissions.id, submissionId));
}

/** Creates (or returns) the job for a submission version — never duplicates. */
export async function enqueueEvaluation(tx: Tx, submissionId: string, version = 1) {
  const jobKey = `${submissionId}:v${version}`;
  await tx.insert(schema.evaluationJobs).values({ submissionId, jobKey, version, status: "QUEUED" }).onConflictDoNothing();
  const [job] = await tx.select().from(schema.evaluationJobs).where(eq(schema.evaluationJobs.jobKey, jobKey));
  await tx.update(schema.submissions).set({ status: "QUEUED" }).where(and(eq(schema.submissions.id, submissionId), eq(schema.submissions.status, "UPLOADED")));
  return job;
}

/**
 * Atomically claims runnable jobs. SKIP LOCKED lets concurrent workers (cron +
 * post-submit trigger + status polling) run safely; stale locks are reclaimed.
 */
export async function claimJobs(limit: number, onlyJobId?: string) {
  const worker = randomUUID();
  const staleBefore = new Date(Date.now() - LOCK_TIMEOUT_MS);
  const t = schema.evaluationJobs;
  const result = await db().execute<{ id: string }>(sql`
    update ${t} set locked_at = now(), locked_by = ${worker}, status = 'PROCESSING', attempts = ${t.attempts} + 1,
      started_at = coalesce(${t.startedAt}, now()), updated_at = now()
    where ${t.id} in (
      select id from ${t}
      where (
        (${t.status} = 'QUEUED' and ${t.nextRunAt} <= now())
        or (${t.status} in ('PROCESSING', 'EXTRACTING', 'EVALUATING') and ${t.lockedAt} < ${staleBefore})
      )
      and ${t.attempts} < ${t.maxAttempts}
      ${onlyJobId ? sql`and ${t.id} = ${onlyJobId}` : sql``}
      order by ${t.nextRunAt}
      limit ${limit}
      for update skip locked
    )
    returning id
  `);
  return { worker, jobIds: result.rows.map((r) => r.id) };
}

/** Process up to `limit` queued jobs (bounded batch, safe for Vercel's time limits). */
export async function processPendingJobs(limit = env().EVALUATION_BATCH_SIZE, onlyJobId?: string) {
  const { worker, jobIds } = await claimJobs(limit, onlyJobId);
  const results: { jobId: string; status: string }[] = [];
  for (const id of jobIds) results.push({ jobId: id, status: await runJob(id, worker) });
  return results;
}

async function loadContext(submissionId: string): Promise<{ ctx: EvalContext; studentProfileId: string; assignmentId: string; topicId: string; estimatedMinutes: number; dueAt: Date }> {
  const d = db();
  const [row] = await d
    .select({
      submission: schema.submissions,
      assignment: schema.assignments,
      topicName: schema.topics.name,
      subjectName: schema.subjects.name,
    })
    .from(schema.submissions)
    .innerJoin(schema.assignments, eq(schema.assignments.id, schema.submissions.assignmentId))
    .innerJoin(schema.topics, eq(schema.topics.id, schema.assignments.topicId))
    .innerJoin(schema.subjects, eq(schema.subjects.id, schema.assignments.subjectId))
    .where(eq(schema.submissions.id, submissionId));
  if (!row) throw new AIError("bad_request", "Submission not found");
  const questions = await d.select().from(schema.assignmentQuestions).where(eq(schema.assignmentQuestions.assignmentId, row.assignment.id)).orderBy(asc(schema.assignmentQuestions.position));
  const rubrics = questions.length
    ? await d
        .select()
        .from(schema.markingRubrics)
        .where(and(inArray(schema.markingRubrics.questionId, questions.map((q) => q.id)), eq(schema.markingRubrics.isActive, true)))
        .orderBy(desc(schema.markingRubrics.version))
    : [];
  const files = await d.select().from(schema.submissionFiles).where(eq(schema.submissionFiles.submissionId, submissionId)).orderBy(asc(schema.submissionFiles.pageOrder));
  const s = storage();
  const fileData = await Promise.all(files.map(async (f) => ({ mimeType: f.mimeType, name: f.fileName, bytes: await s.getBytes(f.storageKey) })));

  // Learning context: repeated error types on this topic.
  const [tp] = await d
    .select({ repeatedErrors: schema.topicProgress.repeatedErrors, accuracy: schema.topicProgress.accuracy })
    .from(schema.topicProgress)
    .where(and(eq(schema.topicProgress.studentProfileId, row.submission.studentProfileId), eq(schema.topicProgress.topicId, row.assignment.topicId)));
  const learningContext: string[] = [];
  if (tp) {
    const top = Object.entries(tp.repeatedErrors).sort((a, b) => b[1] - a[1]).slice(0, 2);
    if (top.length) learningContext.push(`previous ${top.map(([k, n]) => `${k} mistakes ×${n}`).join(", ")} in this topic`);
  }

  const ctx: EvalContext = {
    submissionId,
    grade: row.assignment.grade,
    subject: row.subjectName,
    topic: row.topicName,
    assignmentTitle: row.assignment.title,
    markingScheme: row.assignment.markingConfig.markingScheme || undefined,
    allowAlternativeMethods: row.assignment.markingConfig.allowAlternativeMethods,
    learningContext,
    files: fileData,
    questions: questions.map((q) => {
      const r = rubrics.find((x) => x.questionId === q.id);
      return {
        id: q.id,
        number: q.position,
        text: q.questionText,
        maxMarks: q.maxMarks,
        expectedAnswer: q.expectedAnswer,
        expectedSolution: q.expectedSolution,
        rubric: r ? { steps: r.steps, source: r.source, alternativeMethods: r.alternativeMethods } : null,
      };
    }),
  };
  return {
    ctx,
    studentProfileId: row.submission.studentProfileId,
    assignmentId: row.assignment.id,
    topicId: row.assignment.topicId,
    estimatedMinutes: row.assignment.estimatedMinutes,
    dueAt: row.assignment.dueAt,
  };
}

/** Runs the full pipeline for one claimed job. Returns the final job status. */
export async function runJob(jobId: string, worker: string): Promise<string> {
  const d = db();
  const [job] = await d.select().from(schema.evaluationJobs).where(eq(schema.evaluationJobs.id, jobId));
  if (!job || job.lockedBy !== worker) return "SKIPPED";
  try {
    const loaded = await loadContext(job.submissionId);
    const { ctx } = loaded;
    if (!ctx.files.length) throw new AIError("bad_request", "Submission has no files.");

    await setStatus(job.id, job.submissionId, "EXTRACTING");
    const extraction = await extractHandwriting(ctx);

    await setStatus(job.id, job.submissionId, "EVALUATING");
    const rubrics = await establishRubrics(ctx);
    const graded = await gradeAnswers(ctx, extraction, rubrics);
    const feedback = await generateFeedback(ctx, graded.questions, extraction);

    // Validate the final per-question results before persisting anything.
    const finals = graded.questions.map((g) => {
      const q = ctx.questions.find((x) => x.id === g.questionId)!;
      const ex = extraction.byNumber.get(g.number)!;
      const fb = feedback.byNumber.get(g.number);
      return finalQuestionResultSchema.parse({
        submissionId: job.submissionId,
        questionId: g.questionId,
        extractedAnswer: ex.finalAnswer ?? "",
        extractedSteps: ex.steps,
        expectedAnswer: q.expectedAnswer,
        maximumMarks: g.max,
        awardedMarks: g.awarded,
        conceptAccuracy: g.conceptAccuracy,
        calculationAccuracy: g.calculationAccuracy,
        finalAnswerStatus: g.finalAnswerStatus,
        stepResults: g.steps.map((s) => ({ description: s.description, awarded: s.awarded, max: s.max, status: s.status })),
        mistakeClassification: g.mistakeTypes,
        explanation: fb?.explanation ?? "Review this question with your parent.",
        recommendedPractice: fb?.recommendedPractice ?? [],
        confidence: g.confidence,
        reviewRequired: g.needsReview,
      });
    });

    const reviewReasons = [...extraction.reviewReasons, ...graded.questions.flatMap((g) => g.reviewReasons)];
    const needsReview = reviewReasons.length > 0;
    const score = Math.round(finals.reduce((s, f) => s + f.awardedMarks, 0) * 100) / 100;
    const maxScore = Math.round(ctx.questions.reduce((s, q) => s + q.maxMarks, 0) * 100) / 100;
    const confidence = finals.length ? Math.min(...finals.map((f) => f.confidence)) : 0;
    const finalStatus: Status = needsReview ? "NEEDS_REVIEW" : "COMPLETED";

    await d.transaction(async (tx) => {
      // Persist newly generated rubrics (versioned) so later evaluations reuse them.
      for (const r of rubrics) {
        if (!r.generated) continue;
        const [{ v }] = await tx
          .select({ v: sql<number>`coalesce(max(${schema.markingRubrics.version}), 0)` })
          .from(schema.markingRubrics)
          .where(eq(schema.markingRubrics.questionId, r.questionId));
        await tx.insert(schema.markingRubrics).values({
          questionId: r.questionId,
          source: "AI_GENERATED",
          version: Number(v) + 1,
          steps: r.steps,
          alternativeMethods: r.alternativeMethods,
          expectedSolution: r.expectedSolution,
          totalMarks: r.steps.reduce((s, x) => s + x.marks, 0),
          model: r.model,
          promptVersion: PROMPT_VERSIONS.rubric,
        });
      }

      await tx.update(schema.evaluations).set({ isCurrent: false }).where(eq(schema.evaluations.submissionId, job.submissionId));
      const [ev] = await tx
        .insert(schema.evaluations)
        .values({
          submissionId: job.submissionId,
          jobId: job.id,
          version: job.version,
          isCurrent: true,
          aiScore: score,
          score,
          maxScore,
          summary: graded.summary,
          strengths: graded.strengths.slice(0, 6),
          needsAttention: graded.needsAttention.slice(0, 6),
          suggestedPractice: feedback.suggestedPractice.slice(0, 5),
          confidence,
          needsReview,
          reviewReasons,
          extraction: extraction.raw,
          model: `${extraction.model}/${graded.model}`,
          promptVersion: `${PROMPT_VERSIONS.extraction}+${PROMPT_VERSIONS.evaluation}`,
        })
        .onConflictDoNothing()
        .returning();
      if (!ev) return; // already persisted by a previous run of this job version

      for (const f of finals) {
        const g = graded.questions.find((x) => x.questionId === f.questionId)!;
        const fb = feedback.byNumber.get(g.number);
        const [qe] = await tx
          .insert(schema.questionEvaluations)
          .values({
            evaluationId: ev.id,
            questionId: f.questionId,
            position: g.number,
            extractedAnswer: f.extractedAnswer,
            extractedSteps: f.extractedSteps,
            expectedAnswer: f.expectedAnswer,
            maxMarks: f.maximumMarks,
            aiMarks: f.awardedMarks,
            awardedMarks: f.awardedMarks,
            result: g.result,
            conceptAccuracy: f.conceptAccuracy,
            calculationAccuracy: f.calculationAccuracy,
            finalAnswerStatus: f.finalAnswerStatus,
            mistakeTypes: f.mistakeClassification,
            mistakeDescription: g.mistakeDescription,
            explanation: f.explanation,
            feedback: fb?.feedback ?? null,
            recommendedPractice: f.recommendedPractice,
            confidence: f.confidence,
            needsReview: f.reviewRequired,
            verification: g.verification,
          })
          .returning();
        await tx.insert(schema.evaluationSteps).values(
          g.steps.map((s) => ({ questionEvaluationId: qe.id, position: s.position, description: s.description, awardedMarks: s.awarded, maxMarks: s.max, status: s.status, comment: s.comment })),
        );
        if (g.result !== "CORRECT") {
          const q = ctx.questions.find((x) => x.id === f.questionId)!;
          await tx
            .insert(schema.mistakeNotebook)
            .values({
              studentProfileId: loaded.studentProfileId,
              topicId: loaded.topicId,
              questionEvaluationId: qe.id,
              questionText: q.text,
              studentAnswer: f.extractedAnswer,
              expectedAnswer: q.expectedAnswer,
              mistakeType: g.mistakeTypes[0] ?? null,
              explanation: f.explanation,
            })
            .onConflictDoNothing();
        }
      }

      await tx
        .update(schema.evaluationJobs)
        .set({ status: finalStatus, completedAt: new Date(), lockedAt: null, lockedBy: null, lastError: null, updatedAt: new Date() })
        .where(eq(schema.evaluationJobs.id, job.id));
      await tx.update(schema.submissions).set({ status: finalStatus }).where(eq(schema.submissions.id, job.submissionId));

      await applyEvaluationRewards(tx, {
        studentProfileId: loaded.studentProfileId,
        assignmentId: loaded.assignmentId,
        topicId: loaded.topicId,
        submissionId: job.submissionId,
        score,
        maxScore,
        needsReview,
        estimatedMinutes: loaded.estimatedMinutes,
        questions: graded.questions.length,
        correct: graded.questions.filter((g) => g.result === "CORRECT").length,
        errorTypes: graded.questions.flatMap((g) => g.mistakeTypes),
        title: ctx.assignmentTitle,
      });
      await tx.update(schema.evaluations).set({ xpAwarded: sql`(select coalesce(sum(amount),0) from ${schema.xpTransactions} where source_type = 'assignment' and source_id = ${loaded.assignmentId})` }).where(eq(schema.evaluations.id, ev.id));
    });
    return finalStatus;
  } catch (e) {
    return handleJobError(job, e);
  }
}

/** XP, streak, mastery and achievements for a completed evaluation (idempotent per assignment). */
export async function applyEvaluationRewards(
  tx: Tx,
  a: {
    studentProfileId: string;
    assignmentId: string;
    topicId: string;
    submissionId: string;
    score: number;
    maxScore: number;
    needsReview: boolean;
    estimatedMinutes: number;
    questions: number;
    correct: number;
    errorTypes: string[];
    title: string;
  },
) {
  const fam = await familyContext(tx, a.studentProfileId);
  const p = pct(a.score, a.maxScore);
  await recordActivity(tx, {
    studentProfileId: a.studentProfileId,
    familyId: fam.familyId,
    timezone: fam.timezone,
    type: "ASSIGNMENT_COMPLETED",
    sourceType: "assignment",
    sourceId: a.assignmentId,
    minutes: a.estimatedMinutes,
    dailyGoalMinutes: fam.dailyGoalMinutes,
  });
  // Keyed by assignment, so resubmissions never earn completion XP twice.
  await awardXp(tx, { studentProfileId: a.studentProfileId, ruleKey: "HOMEWORK_COMPLETED", amount: fam.rules.HOMEWORK_COMPLETED, sourceType: "assignment", sourceId: a.assignmentId, description: `${a.title} completed` });
  // Score bonuses wait for parent review when the evaluation is uncertain.
  if (!a.needsReview) {
    const bonus = scoreBonusRule(p);
    if (bonus) await awardXp(tx, { studentProfileId: a.studentProfileId, ruleKey: bonus, amount: fam.rules[bonus], sourceType: "assignment", sourceId: a.assignmentId, description: `Scored ${Math.round(p)}% on ${a.title}` });
  }
  await recordTopicAttempt(tx, { studentProfileId: a.studentProfileId, topicId: a.topicId, scorePct: p, questions: a.questions, correct: a.correct, errorTypes: a.errorTypes });
  await afterProgress(tx, a.studentProfileId, fam.timezone);
}

async function handleJobError(job: typeof schema.evaluationJobs.$inferSelect, e: unknown): Promise<string> {
  const d = db();
  const err = e instanceof AIError ? e : new AIError("unavailable", e instanceof Error ? e.message : String(e));
  console.error(`[evaluation] job ${job.id} attempt ${job.attempts} failed: ${err.kind} ${err.message}`);
  const exhausted = job.attempts >= job.maxAttempts;
  if (err.retryable && !exhausted) {
    const backoffMs = Math.max(err.retryAfterMs ?? 0, 30_000 * 2 ** (job.attempts - 1));
    await d
      .update(schema.evaluationJobs)
      .set({ status: "QUEUED", nextRunAt: new Date(Date.now() + backoffMs), lockedAt: null, lockedBy: null, lastError: `${err.kind}: ${err.message}`.slice(0, 1000), updatedAt: new Date() })
      .where(eq(schema.evaluationJobs.id, job.id));
    await d.update(schema.submissions).set({ status: "QUEUED" }).where(eq(schema.submissions.id, job.submissionId));
    return "QUEUED";
  }
  await d
    .update(schema.evaluationJobs)
    .set({ status: "FAILED", lockedAt: null, lockedBy: null, lastError: `${err.kind}: ${err.message}`.slice(0, 1000), completedAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.evaluationJobs.id, job.id));
  await d.update(schema.submissions).set({ status: "FAILED" }).where(eq(schema.submissions.id, job.submissionId));
  return "FAILED";
}

/** Manual recovery: re-run a failed job, or re-evaluate as a new version. */
export async function requeueEvaluation(submissionId: string, opts: { newVersion: boolean }) {
  const d = db();
  return d.transaction(async (tx) => {
    const [latest] = await tx.select().from(schema.evaluationJobs).where(eq(schema.evaluationJobs.submissionId, submissionId)).orderBy(desc(schema.evaluationJobs.version)).limit(1);
    if (!latest || opts.newVersion) return enqueueEvaluation(tx, submissionId, (latest?.version ?? 0) + 1);
    await tx
      .update(schema.evaluationJobs)
      .set({ status: "QUEUED", attempts: 0, nextRunAt: new Date(), lockedAt: null, lockedBy: null, completedAt: null, updatedAt: new Date() })
      .where(eq(schema.evaluationJobs.id, latest.id));
    await tx.update(schema.submissions).set({ status: "QUEUED" }).where(eq(schema.submissions.id, submissionId));
    return latest;
  });
}

/** Jobs that look stuck — used by the maintenance cron for visibility. */
export async function stuckJobs() {
  return db()
    .select({ id: schema.evaluationJobs.id, status: schema.evaluationJobs.status, attempts: schema.evaluationJobs.attempts })
    .from(schema.evaluationJobs)
    .where(and(eq(schema.evaluationJobs.status, "QUEUED"), lte(schema.evaluationJobs.nextRunAt, new Date(Date.now() - 3600_000))));
}
