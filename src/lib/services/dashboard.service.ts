import "server-only";
import { and, asc, desc, eq, gte, isNull, lt } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { assertStudentAccess, type Actor } from "@/lib/security/actor";
import { addDaysStr, localDateIn, weekStartOf } from "@/lib/utils/timezone";
import { computeMetrics, pct } from "./gamification";
import { topicProgressFor, recommend } from "./progress";

/** Parent dashboard aggregates — every number is computed from database records. */
export async function parentDashboard(actor: Actor, studentProfileId: string) {
  await assertStudentAccess(actor, studentProfileId);
  const d = db();
  const [profile] = await d.select().from(schema.studentProfiles).where(eq(schema.studentProfiles.id, studentProfileId));
  const tz = actor.timezone;
  const today = localDateIn(tz);
  const now = new Date();

  const assignments = await d.select().from(schema.assignments).where(and(eq(schema.assignments.studentProfileId, studentProfileId), isNull(schema.assignments.deletedAt)));
  const subs = await d
    .select({ s: schema.submissions, title: schema.assignments.title })
    .from(schema.submissions)
    .innerJoin(schema.assignments, eq(schema.assignments.id, schema.submissions.assignmentId))
    .where(and(eq(schema.submissions.studentProfileId, studentProfileId), isNull(schema.submissions.deletedAt)))
    .orderBy(desc(schema.submissions.submittedAt));
  const evals = await d
    .select({ score: schema.evaluations.score, max: schema.evaluations.maxScore, at: schema.evaluations.createdAt, submissionId: schema.evaluations.submissionId })
    .from(schema.evaluations)
    .innerJoin(schema.submissions, eq(schema.submissions.id, schema.evaluations.submissionId))
    .where(and(eq(schema.submissions.studentProfileId, studentProfileId), eq(schema.evaluations.isCurrent, true), isNull(schema.submissions.deletedAt)))
    .orderBy(asc(schema.evaluations.createdAt));
  const pcts = evals.map((e) => pct(e.score, e.max));
  const submittedAssignments = new Set(subs.filter((x) => x.s.status !== "FAILED").map((x) => x.s.assignmentId));
  const dueSoFar = assignments.filter((a) => a.dueAt <= now || submittedAssignments.has(a.id));

  const ws = weekStartOf(today);
  const weekActivity = await d
    .select({ day: schema.learningActivityLogs.localDate, minutes: schema.learningActivityLogs.minutes })
    .from(schema.learningActivityLogs)
    .where(and(eq(schema.learningActivityLogs.studentProfileId, studentProfileId), gte(schema.learningActivityLogs.localDate, ws), lt(schema.learningActivityLogs.localDate, addDaysStr(ws, 7))));

  const half = Math.floor(pcts.length / 2);
  const firstHalf = pcts.slice(0, Math.max(1, half));
  const secondHalf = pcts.slice(half);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

  const tp = await topicProgressFor(d, studentProfileId, profile.grade);
  const errorCounts: Record<string, number> = {};
  for (const t of tp) for (const [k, n] of Object.entries(t.repeatedErrors as Record<string, number>)) errorCounts[k] = (errorCounts[k] ?? 0) + n;
  const metrics = await computeMetrics(d, studentProfileId, tz);
  const [{ openMistakes }] = await d
    .select({ openMistakes: schema.mistakeNotebook.id })
    .from(schema.mistakeNotebook)
    .where(and(eq(schema.mistakeNotebook.studentProfileId, studentProfileId), eq(schema.mistakeNotebook.status, "OPEN")))
    .limit(1)
    .then((r) => [{ openMistakes: r.length }]);

  return {
    totalAssignments: assignments.length,
    completionRate: dueSoFar.length ? Math.round((dueSoFar.filter((a) => submittedAssignments.has(a.id)).length / dueSoFar.length) * 100) : 100,
    averageScore: Math.round(avg(pcts)),
    currentStreak: metrics.streak,
    longestStreak: metrics.longest_streak,
    weeklyStudyDays: new Set(weekActivity.map((a) => a.day)).size,
    weeklyStudyMinutes: weekActivity.reduce((s, a) => s + a.minutes, 0),
    topicAccuracy: tp.map((t) => ({ topic: t.topicName, accuracy: Math.round(Number(t.accuracy)), attempts: Number(t.totalAttempts), masteryLevel: t.masteryLevel })),
    weakTopics: tp.filter((t) => Number(t.totalAttempts) > 0 && Number(t.masteryScore) < 65).map((t) => ({ topic: t.topicName, mastery: Math.round(Number(t.masteryScore)) })),
    repeatedMistakes: Object.entries(errorCounts).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).map(([kind, count]) => ({ kind, count })),
    correctedMistakes: metrics.mistakes_corrected,
    hasOpenMistakes: openMistakes > 0,
    improvementPercent: pcts.length >= 2 ? Math.round(avg(secondHalf) - avg(firstHalf)) : 0,
    recommendations: recommend(tp.map((t) => ({ ...t, totalAttempts: Number(t.totalAttempts), accuracy: Number(t.accuracy), masteryScore: Number(t.masteryScore) }))).slice(0, 3),
    recentSubmissions: subs.slice(0, 5).map((x) => {
      const e = evals.find((ev) => ev.submissionId === x.s.id);
      return { id: x.s.id, title: x.title, submittedAt: x.s.submittedAt.toISOString(), status: x.s.status, score: e?.score ?? null, maxScore: e?.max ?? null };
    }),
  };
}
