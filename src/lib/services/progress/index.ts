import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { schema, type Tx, type DbOrTx } from "@/lib/db";
import { masteryLevel, masteryScore, RECENT_WINDOW, recommend } from "./mastery";

export * from "./mastery";

/**
 * Record an assessed attempt on a topic (homework or practice).
 * `scorePct` is the overall score for this assessment; `questions`/`correct`
 * count individual questions for accuracy.
 */
export async function recordTopicAttempt(
  tx: Tx,
  a: { studentProfileId: string; topicId: string; scorePct: number; questions: number; correct: number; errorTypes: string[]; isRevision?: boolean },
) {
  await tx
    .insert(schema.topicProgress)
    .values({ studentProfileId: a.studentProfileId, topicId: a.topicId })
    .onConflictDoNothing();
  const [row] = await tx
    .select()
    .from(schema.topicProgress)
    .where(and(eq(schema.topicProgress.studentProfileId, a.studentProfileId), eq(schema.topicProgress.topicId, a.topicId)))
    .for("update");
  const totalAttempts = row.totalAttempts + a.questions;
  const correctAttempts = row.correctAttempts + a.correct;
  const assessments = row.recentScores.length; // approx count for running average
  const recentScores = [...row.recentScores, Math.round(a.scorePct)].slice(-RECENT_WINDOW);
  const repeatedErrors = { ...row.repeatedErrors };
  for (const e of a.errorTypes) repeatedErrors[e] = (repeatedErrors[e] ?? 0) + 1;
  const input = { recentScores, totalAttempts, previousMasteryScore: row.masteryScore };
  const score = masteryScore(input);
  await tx
    .update(schema.topicProgress)
    .set({
      totalAttempts,
      correctAttempts,
      accuracy: totalAttempts ? Math.round((correctAttempts / totalAttempts) * 1000) / 10 : 0,
      averageMarksPct: Math.round(((row.averageMarksPct * assessments + a.scorePct) / (assessments + 1)) * 10) / 10,
      recentScores,
      repeatedErrors,
      previousMasteryScore: row.masteryScore,
      masteryScore: score,
      masteryLevel: masteryLevel(score, input),
      revisionCount: a.isRevision ? sql`${schema.topicProgress.revisionCount} + 1` : row.revisionCount,
      lastActivityAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.topicProgress.id, row.id));
}

export async function topicProgressFor(tx: DbOrTx, studentProfileId: string, grade: number) {
  const subjectRows = await tx.select({ id: schema.subjects.id }).from(schema.subjects).where(eq(schema.subjects.code, "mathematics"));
  const subjectId = subjectRows[0]?.id;
  if (!subjectId) return [];
  return tx
    .select({
      topicId: schema.topics.id,
      code: schema.topics.code,
      topicName: schema.topics.name,
      chapter: schema.topics.chapter,
      totalAttempts: sql<number>`coalesce(${schema.topicProgress.totalAttempts}, 0)`,
      accuracy: sql<number>`coalesce(${schema.topicProgress.accuracy}, 0)`,
      masteryScore: sql<number>`coalesce(${schema.topicProgress.masteryScore}, 0)`,
      previousMasteryScore: sql<number>`coalesce(${schema.topicProgress.previousMasteryScore}, 0)`,
      masteryLevel: sql<string>`coalesce(${schema.topicProgress.masteryLevel}, 'NOT_STARTED')`,
      recentScores: sql<number[]>`coalesce(${schema.topicProgress.recentScores}, '[]'::jsonb)`,
      repeatedErrors: sql<Record<string, number>>`coalesce(${schema.topicProgress.repeatedErrors}, '{}'::jsonb)`,
    })
    .from(schema.topics)
    .leftJoin(schema.topicProgress, and(eq(schema.topicProgress.topicId, schema.topics.id), eq(schema.topicProgress.studentProfileId, studentProfileId)))
    .where(and(eq(schema.topics.subjectId, subjectId), eq(schema.topics.grade, grade)))
    .orderBy(schema.topics.chapter);
}

export async function recommendationsFor(tx: DbOrTx, studentProfileId: string, grade: number) {
  const rows = await topicProgressFor(tx, studentProfileId, grade);
  return recommend(rows.map((r) => ({ ...r, totalAttempts: Number(r.totalAttempts), accuracy: Number(r.accuracy), masteryScore: Number(r.masteryScore) })));
}
