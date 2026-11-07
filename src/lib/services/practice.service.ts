"use client";

import type { Difficulty, PracticeAttempt, PracticeQuestion, PracticeResult, PracticeSessionConfig } from "@/types";
import { pct, sleep, uid } from "@/lib/utils";
import { xpForPractice } from "@/lib/utils/gamification";
import { PRACTICE_BANK } from "@/lib/mock-data/practice-bank";
import { topicName } from "@/lib/mock-data/curriculum";
import { getDB, setDB } from "./store";
import { applyProgress, awardXP, markStudied, updateTopic } from "./progress-engine";

export interface PracticeItem extends PracticeQuestion {
  /** retry questions from homework may need self-checking against the model answer */
  selfCheck?: boolean;
}

export interface PracticeSession {
  id: string;
  title: string;
  config: PracticeSessionConfig;
  items: PracticeItem[];
  retryOf?: string;
}

function shuffle<T>(arr: T[], seed = Date.now()): T[] {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pick(topicIds: string[], difficulties: Difficulty[], count: number, seed?: number): PracticeItem[] {
  const pool = PRACTICE_BANK.filter((q) => topicIds.includes(q.topicId) && difficulties.includes(q.difficulty));
  const primary = shuffle(pool, seed);
  if (primary.length >= count) return primary.slice(0, count);
  // top up with any difficulty from the same topics
  const extra = shuffle(
    PRACTICE_BANK.filter((q) => topicIds.includes(q.topicId) && !primary.includes(q)),
    seed,
  );
  return [...primary, ...extra].slice(0, count);
}

function weakTopics(n = 2): string[] {
  return [...getDB().topicProgress]
    .filter((t) => t.attempts > 0)
    .sort((a, b) => a.mastery - b.mastery)
    .slice(0, n)
    .map((t) => t.topicId);
}

export const SPECIAL_MODES = {
  daily: { title: "Daily Challenge", description: "5 mixed questions, fresh every day", count: 5, xp: "+65 XP" },
  weak: { title: "Weak-Topic Booster", description: "Target the topics that need love", count: 6, xp: "+75 XP" },
  revision: { title: "Quick Revision", description: "Easy recap of topics you've covered", count: 5, xp: "+50 XP" },
  weekly: { title: "Weekly Challenge", description: "10 tough questions. Are you ready?", count: 10, xp: "+140 XP" },
} as const;

export function buildSession(config: PracticeSessionConfig): PracticeSession {
  const allTopics = getDB().topicProgress.map((t) => t.topicId);
  const today = new Date();
  const daySeed = today.getFullYear() * 1000 + today.getMonth() * 40 + today.getDate();
  let items: PracticeItem[];
  let title: string;
  switch (config.mode) {
    case "daily":
      items = pick(allTopics, ["easy", "medium"], 5, daySeed);
      title = SPECIAL_MODES.daily.title;
      break;
    case "weak":
      items = pick(weakTopics(), ["easy", "medium"], 6);
      title = SPECIAL_MODES.weak.title;
      break;
    case "revision": {
      const covered = getDB().topicProgress.filter((t) => t.attempts > 0).map((t) => t.topicId);
      items = pick(covered, ["easy"], 5);
      title = SPECIAL_MODES.revision.title;
      break;
    }
    case "weekly":
      items = pick(allTopics, ["hard"], 10, daySeed - today.getDay());
      title = SPECIAL_MODES.weekly.title;
      break;
    default:
      items = pick(config.topicId === "mixed" ? allTopics : [config.topicId], [config.difficulty], config.count);
      title = config.topicId === "mixed" ? "Mixed Practice" : topicName(config.topicId);
  }
  return { id: uid("ps"), title, config: { ...config, count: items.length }, items };
}

/** Build a retry session from the incorrect/partial questions of an evaluation. */
export function buildRetrySession(evaluationId: string): PracticeSession | null {
  const db = getDB();
  const e = db.evaluations.find((x) => x.id === evaluationId);
  if (!e) return null;
  const a = db.assignments.find((x) => x.id === e.assignmentId);
  const wrong = e.results.filter((r) => r.status !== "correct");
  if (!wrong.length) return null;
  const items: PracticeItem[] = wrong.map((r) => {
    const parts = r.expectedAnswer.split("=");
    const finalPart = parts[parts.length - 1].trim();
    return {
      id: `retry_${r.questionId}`,
      topicId: a?.topicId ?? "mixed",
      difficulty: "medium",
      text: r.question,
      answer: finalPart,
      accepts: [r.expectedAnswer],
      hint: r.errors[0]?.description ?? "Look at your previous working and find the step that went wrong.",
      explanation: r.explanation,
      selfCheck: true,
    };
  });
  return {
    id: uid("ps"),
    title: `Retry: ${a?.title ?? "Homework"}`,
    config: { subjectId: "mathematics", topicId: a?.topicId ?? "mixed", difficulty: "medium", count: items.length, mode: "revision" },
    items,
    retryOf: evaluationId,
  };
}

export async function completeSession(session: PracticeSession, attempts: PracticeAttempt[]): Promise<PracticeResult> {
  await sleep(700);
  const correct = attempts.filter((a) => a.correct).length;
  const total = session.items.length;
  const xpEarned = session.retryOf ? correct * 15 + 10 : xpForPractice(correct, total);
  const result: PracticeResult = {
    id: uid("p"),
    config: session.config,
    attempts,
    correct,
    total,
    xpEarned,
    completedAt: new Date().toISOString(),
  };
  setDB((db) => {
    let next = { ...db, practiceResults: [result, ...db.practiceResults] };
    next = markStudied(next, Math.max(5, total * 2));
    next = awardXP(next, xpEarned, session.retryOf ? `Corrected ${correct} mistake${correct === 1 ? "" : "s"}` : session.title, session.retryOf ? "correction" : "practice");
    if (session.retryOf) {
      next = { ...next, student: { ...next.student, mistakesCorrected: next.student.mistakesCorrected + correct } };
    }
    const topics = [...new Set(session.items.map((i) => i.topicId))].filter((t) => t !== "mixed");
    for (const t of topics) {
      const its = session.items.filter((i) => i.topicId === t);
      const c = its.filter((i) => attempts.find((a) => a.questionId === i.id)?.correct).length;
      next = updateTopic(next, t, pct(c, its.length), 0.25);
    }
    return applyProgress(next);
  });
  return result;
}
