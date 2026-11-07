/**
 * Pure gamification rules: streaks, levels, achievements and reward unlocks.
 * Runs after every state mutation. In Phase 2 this logic moves server-side.
 */
import type { Achievement, Evaluation, PracticeResult, XPEvent } from "@/types";
import { computeStreak, dayKey, longestStreak, pct, uid } from "@/lib/utils";
import { levelFromXP } from "@/lib/utils/gamification";
import type { DemoDB } from "./store";

function sortedEvalPcts(evals: Evaluation[]) {
  return [...evals]
    .sort((a, b) => a.evaluatedAt.localeCompare(b.evaluatedAt))
    .map((e) => pct(e.parentOverride?.score ?? e.score, e.maxScore));
}

export function bestScore(evals: Evaluation[], practice: PracticeResult[]): number {
  const e = evals.map((x) => pct(x.parentOverride?.score ?? x.score, x.maxScore));
  const p = practice.filter((r) => r.total >= 5).map((r) => pct(r.correct, r.total));
  return Math.max(0, ...e, ...p);
}

export function improvementPoints(evals: Evaluation[]): number {
  const pcts = sortedEvalPcts(evals);
  let best = 0;
  let min = Infinity;
  for (const p of pcts) {
    if (min !== Infinity) best = Math.max(best, p - min);
    min = Math.min(min, p);
  }
  return best;
}

function achievementCurrent(a: Achievement, db: DemoDB): number {
  const s = db.student;
  switch (a.id) {
    case "first-mission":
      return db.evaluations.length;
    case "three-day-spark":
      return Math.max(s.streak, s.longestStreak);
    case "seven-day-champion":
      return s.streak;
    case "accuracy-star":
      return bestScore(db.evaluations, db.practiceResults);
    case "comeback-hero":
      return improvementPoints(db.evaluations);
    case "mistake-master":
      return s.mistakesCorrected;
    case "math-explorer":
      return db.topicProgress.filter((t) => t.mastery >= 80).length;
    case "practice-pro":
      return db.practiceResults.length;
    case "early-bird":
      return db.submissions.filter((sub) => {
        const a2 = db.assignments.find((x) => x.id === sub.assignmentId);
        return a2 && sub.submittedAt <= a2.dueDate;
      }).length;
    default:
      return a.current;
  }
}

export function applyProgress(db: DemoDB): DemoDB {
  const now = new Date().toISOString();
  let xp = db.student.xp;
  const newEvents: XPEvent[] = [];
  const celebrations = [...db.celebrations];

  const student = {
    ...db.student,
    streak: computeStreak(db.student.studyDays),
    longestStreak: Math.max(db.student.longestStreak, longestStreak(db.student.studyDays)),
  };
  let next: DemoDB = { ...db, student };

  const achievements = next.achievements.map((a) => {
    const current = Math.min(achievementCurrent(a, next), a.target);
    if (!a.unlockedAt && current >= a.target) {
      xp += a.xpReward;
      newEvents.push({ id: uid("x"), label: `Badge: ${a.title}`, xp: a.xpReward, at: now, kind: "achievement" });
      celebrations.push(a.id);
      return { ...a, current, unlockedAt: now };
    }
    return { ...a, current: a.unlockedAt ? a.target : current };
  });

  const best = bestScore(next.evaluations, next.practiceResults);
  const improvement = improvementPoints(next.evaluations);
  const rewards = next.rewards.map((r) => {
    if (r.status !== "locked" || !next.appPrefs.autoUnlockRewards) return r;
    const met =
      (r.trigger === "streak" && student.streak >= r.threshold) ||
      (r.trigger === "xp" && xp >= r.threshold) ||
      (r.trigger === "score" && best >= r.threshold) ||
      (r.trigger === "improvement" && improvement >= r.threshold);
    return met ? { ...r, status: "unlocked" as const, unlockedAt: now } : r;
  });

  next = {
    ...next,
    student: { ...student, xp, level: levelFromXP(xp).level },
    achievements,
    rewards,
    celebrations,
    xpEvents: [...newEvents, ...next.xpEvents],
  };
  return next;
}

/** Records that the student studied today for a number of minutes. */
export function markStudied(db: DemoDB, minutes: number): DemoDB {
  const key = dayKey();
  const days = db.student.studyDays.includes(key) ? db.student.studyDays : [...db.student.studyDays, key];
  return {
    ...db,
    student: { ...db.student, studyDays: days },
    studyMinutes: { ...db.studyMinutes, [key]: (db.studyMinutes[key] ?? 0) + minutes },
  };
}

export function awardXP(db: DemoDB, xp: number, label: string, kind: XPEvent["kind"]): DemoDB {
  return {
    ...db,
    student: { ...db.student, xp: db.student.xp + xp },
    xpEvents: [{ id: uid("x"), label, xp, at: new Date().toISOString(), kind }, ...db.xpEvents],
  };
}

export function updateTopic(db: DemoDB, topicId: string, score: number, weight: number): DemoDB {
  return {
    ...db,
    topicProgress: db.topicProgress.map((t) => {
      if (t.topicId !== topicId) return t;
      const accuracy = t.attempts === 0 ? score : Math.round(t.accuracy * (1 - weight) + score * weight);
      const mastery = Math.min(100, Math.round(t.mastery * (1 - weight) + score * weight + (score >= 80 ? 4 : 0)));
      return {
        ...t,
        accuracy,
        mastery,
        attempts: t.attempts + 1,
        trend: accuracy > t.accuracy ? "up" : accuracy < t.accuracy ? "down" : "flat",
      };
    }),
  };
}
