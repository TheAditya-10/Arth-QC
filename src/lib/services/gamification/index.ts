import "server-only";
import { and, asc, count, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { schema, type DbOrTx, type Tx } from "@/lib/db";
import { localDateIn } from "@/lib/utils/timezone";
import { resolveRules, PRACTICE_XP_DAILY_CAP, type XpRuleKey } from "./rules";
import { effectiveStreak, nextStreak } from "./streak";
import { improvementPoints, pct } from "./metrics";

export * from "./rules";
export * from "./streak";
export * from "./metrics";

export async function familyContext(tx: DbOrTx, studentProfileId: string) {
  const [row] = await tx
    .select({
      familyId: schema.families.id,
      timezone: schema.families.timezone,
      xpRules: schema.families.xpRules,
      autoUnlockRewards: schema.families.autoUnlockRewards,
      dailyGoalMinutes: schema.studentProfiles.dailyGoalMinutes,
    })
    .from(schema.studentProfiles)
    .innerJoin(schema.families, eq(schema.families.id, schema.studentProfiles.familyId))
    .where(eq(schema.studentProfiles.id, studentProfileId));
  if (!row) throw new Error(`Student ${studentProfileId} not found`);
  return { ...row, rules: resolveRules(row.xpRules) };
}

/**
 * Idempotent XP award. The (student, rule, sourceType, sourceId) unique key
 * guarantees retries and resubmissions never double-award.
 * Returns the XP actually awarded (0 if already awarded).
 */
export async function awardXp(
  tx: Tx,
  a: { studentProfileId: string; ruleKey: XpRuleKey | `ACHIEVEMENT:${string}`; amount: number; sourceType: string; sourceId: string; description: string },
): Promise<number> {
  if (a.amount <= 0) return 0;
  const inserted = await tx
    .insert(schema.xpTransactions)
    .values({ studentProfileId: a.studentProfileId, amount: a.amount, ruleKey: a.ruleKey, sourceType: a.sourceType, sourceId: a.sourceId, description: a.description })
    .onConflictDoNothing()
    .returning({ id: schema.xpTransactions.id });
  if (!inserted.length) return 0;
  await tx
    .update(schema.studentProfiles)
    .set({ xpTotal: sql`${schema.studentProfiles.xpTotal} + ${a.amount}`, updatedAt: new Date() })
    .where(eq(schema.studentProfiles.id, a.studentProfileId));
  return a.amount;
}

/** Practice XP respects a per-day cap. */
export async function practiceXpAllowed(tx: DbOrTx, studentProfileId: string, timezone: string): Promise<boolean> {
  const today = localDateIn(timezone);
  const [{ n }] = await tx
    .select({ n: count() })
    .from(schema.learningActivityLogs)
    .where(
      and(
        eq(schema.learningActivityLogs.studentProfileId, studentProfileId),
        eq(schema.learningActivityLogs.activityType, "PRACTICE_COMPLETED"),
        eq(schema.learningActivityLogs.localDate, today),
      ),
    );
  return n <= PRACTICE_XP_DAILY_CAP; // the current session's log row is already inserted
}

/**
 * Records a meaningful learning activity (idempotent per source) and advances the
 * streak using the family's timezone. Returns false if already recorded.
 */
export async function recordActivity(
  tx: Tx,
  a: {
    studentProfileId: string;
    familyId: string;
    timezone: string;
    type: (typeof schema.activityTypeEnum.enumValues)[number];
    sourceType: string;
    sourceId: string;
    minutes: number;
    dailyGoalMinutes: number;
    metadata?: Record<string, unknown>;
  },
): Promise<boolean> {
  const today = localDateIn(a.timezone);
  const inserted = await tx
    .insert(schema.learningActivityLogs)
    .values({
      studentProfileId: a.studentProfileId,
      familyId: a.familyId,
      activityType: a.type,
      sourceType: a.sourceType,
      sourceId: a.sourceId,
      localDate: today,
      minutes: Math.max(0, Math.round(a.minutes)),
      metadata: a.metadata ?? {},
    })
    .onConflictDoNothing()
    .returning({ id: schema.learningActivityLogs.id });
  if (!inserted.length) return false;

  // Streak (row-locked to serialise concurrent activities).
  const [s] = await tx.select().from(schema.studentStreaks).where(eq(schema.studentStreaks.studentProfileId, a.studentProfileId)).for("update");
  const prev = s ?? { currentStreak: 0, longestStreak: 0, lastActivityDate: null };
  const next = nextStreak(prev, today);
  await tx
    .insert(schema.studentStreaks)
    .values({ studentProfileId: a.studentProfileId, ...next, updatedAt: new Date() })
    .onConflictDoUpdate({ target: schema.studentStreaks.studentProfileId, set: { ...next, updatedAt: new Date() } });

  // Daily goal progress.
  await tx
    .insert(schema.dailyGoals)
    .values({
      studentProfileId: a.studentProfileId,
      localDate: today,
      targetMinutes: a.dailyGoalMinutes,
      achievedMinutes: a.minutes,
      completed: a.minutes >= a.dailyGoalMinutes,
    })
    .onConflictDoUpdate({
      target: [schema.dailyGoals.studentProfileId, schema.dailyGoals.localDate],
      set: {
        achievedMinutes: sql`${schema.dailyGoals.achievedMinutes} + ${a.minutes}`,
        completed: sql`${schema.dailyGoals.achievedMinutes} + ${a.minutes} >= ${schema.dailyGoals.targetMinutes}`,
      },
    });
  return true;
}

export interface StudentMetrics {
  assignments_completed: number;
  streak: number;
  longest_streak: number;
  best_homework_score: number;
  improvement_points: number;
  mistakes_corrected: number;
  topics_mastered: number;
  practice_sessions: number;
  xp: number;
}

/** All gamification metrics, computed from database records. */
export async function computeMetrics(tx: DbOrTx, studentProfileId: string, timezone: string): Promise<StudentMetrics> {
  const evals = await tx
    .select({ score: schema.evaluations.score, max: schema.evaluations.maxScore, at: schema.evaluations.createdAt, assignmentId: schema.submissions.assignmentId })
    .from(schema.evaluations)
    .innerJoin(schema.submissions, eq(schema.submissions.id, schema.evaluations.submissionId))
    .where(and(eq(schema.submissions.studentProfileId, studentProfileId), eq(schema.evaluations.isCurrent, true), isNull(schema.submissions.deletedAt)))
    .orderBy(asc(schema.evaluations.createdAt));
  const pcts = evals.map((e) => pct(e.score, e.max));
  const [streak] = await tx.select().from(schema.studentStreaks).where(eq(schema.studentStreaks.studentProfileId, studentProfileId));
  const [{ corrected }] = await tx
    .select({ corrected: count() })
    .from(schema.mistakeNotebook)
    .where(and(eq(schema.mistakeNotebook.studentProfileId, studentProfileId), eq(schema.mistakeNotebook.status, "CORRECTED")));
  const [{ mastered }] = await tx
    .select({ mastered: count() })
    .from(schema.topicProgress)
    .where(and(eq(schema.topicProgress.studentProfileId, studentProfileId), eq(schema.topicProgress.masteryLevel, "MASTERED")));
  const [{ sessions }] = await tx
    .select({ sessions: count() })
    .from(schema.practiceSessions)
    .where(and(eq(schema.practiceSessions.studentProfileId, studentProfileId), eq(schema.practiceSessions.status, "COMPLETED"), isNotNull(schema.practiceSessions.completedAt)));
  const [profile] = await tx.select({ xp: schema.studentProfiles.xpTotal }).from(schema.studentProfiles).where(eq(schema.studentProfiles.id, studentProfileId));
  const streakState = streak ?? { currentStreak: 0, longestStreak: 0, lastActivityDate: null };
  return {
    assignments_completed: new Set(evals.map((e) => e.assignmentId)).size,
    streak: effectiveStreak(streakState, localDateIn(timezone)),
    longest_streak: streakState.longestStreak,
    best_homework_score: Math.max(0, ...pcts),
    improvement_points: improvementPoints(pcts),
    mistakes_corrected: corrected,
    topics_mastered: mastered,
    practice_sessions: sessions,
    xp: profile?.xp ?? 0,
  };
}

function metricFor(ruleType: string, m: StudentMetrics): number {
  switch (ruleType) {
    case "streak":
      return Math.max(m.streak, m.longest_streak);
    case "assignments_completed":
    case "best_homework_score":
    case "improvement_points":
    case "mistakes_corrected":
    case "topics_mastered":
    case "practice_sessions":
      return m[ruleType];
    default:
      return 0;
  }
}

/** Server-side achievement unlocks; awards each achievement's XP once. */
export async function evaluateAchievements(tx: Tx, studentProfileId: string, timezone: string): Promise<string[]> {
  const m = await computeMetrics(tx, studentProfileId, timezone);
  const defs = await tx.select().from(schema.achievements).where(eq(schema.achievements.active, true));
  const unlockedRows = await tx
    .select({ id: schema.studentAchievements.achievementId })
    .from(schema.studentAchievements)
    .where(eq(schema.studentAchievements.studentProfileId, studentProfileId));
  const unlocked = new Set(unlockedRows.map((r) => r.id));
  const newly: string[] = [];
  for (const a of defs) {
    if (unlocked.has(a.id)) continue;
    const value = metricFor(a.ruleType, m);
    if (value < a.threshold) continue;
    const ins = await tx
      .insert(schema.studentAchievements)
      .values({ studentProfileId, achievementId: a.id, progressValue: Math.round(value) })
      .onConflictDoNothing()
      .returning({ id: schema.studentAchievements.id });
    if (!ins.length) continue;
    await awardXp(tx, { studentProfileId, ruleKey: `ACHIEVEMENT:${a.code}`, amount: a.xpReward, sourceType: "achievement", sourceId: a.id, description: `Badge: ${a.title}` });
    newly.push(a.code);
  }
  return newly;
}

/** Metric value used for a reward trigger. */
export function rewardMetric(trigger: string, m: StudentMetrics): number | null {
  switch (trigger) {
    case "XP":
      return m.xp;
    case "STREAK":
      return Math.max(m.streak, m.longest_streak);
    case "SCORE":
      return m.best_homework_score;
    case "IMPROVEMENT":
      return m.improvement_points;
    default:
      return null;
  }
}

/** Runs after any XP-affecting activity: achievements (which may add XP). */
export async function afterProgress(tx: Tx, studentProfileId: string, timezone: string) {
  return evaluateAchievements(tx, studentProfileId, timezone);
}

