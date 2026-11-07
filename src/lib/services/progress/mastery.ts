/**
 * Topic mastery model (pure). Mastery is never based on a single score: it blends
 * recency-weighted scores with a confidence factor that grows with attempts.
 */
export type MasteryLevel = "NOT_STARTED" | "LEARNING" | "IMPROVING" | "PROFICIENT" | "MASTERED";

export const RECENT_WINDOW = 10;
const FULL_CONFIDENCE_ATTEMPTS = 8;

export interface MasteryInput {
  recentScores: number[]; // 0-100, oldest first
  totalAttempts: number;
  previousMasteryScore: number;
}

/** Exponentially weighted mean: the newest score weighs most. */
export function weightedRecent(scores: number[], decay = 0.75): number {
  if (!scores.length) return 0;
  let num = 0;
  let den = 0;
  scores.forEach((s, i) => {
    const w = Math.pow(decay, scores.length - 1 - i);
    num += s * w;
    den += w;
  });
  return num / den;
}

export function masteryScore(input: MasteryInput): number {
  if (!input.recentScores.length) return 0;
  const confidence = Math.min(1, input.totalAttempts / FULL_CONFIDENCE_ATTEMPTS);
  // Low-confidence scores are pulled toward 40 ("still learning") rather than trusted outright.
  const raw = weightedRecent(input.recentScores);
  return Math.round((raw * confidence + 40 * (1 - confidence)) * 10) / 10;
}

export function masteryLevel(score: number, input: MasteryInput): MasteryLevel {
  const n = input.recentScores.length;
  if (input.totalAttempts === 0 || n === 0) return "NOT_STARTED";
  const last3 = input.recentScores.slice(-3);
  const last3Avg = last3.reduce((s, x) => s + x, 0) / last3.length;
  if (score >= 85 && n >= 3 && last3Avg >= 80) return "MASTERED";
  if (score >= 70 && n >= 2) return "PROFICIENT";
  if (score >= 50 || score > input.previousMasteryScore + 5) return "IMPROVING";
  return "LEARNING";
}

/** Map mastery levels to a 0-100 display value used by the existing UI bars. */
export function displayMastery(level: MasteryLevel, score: number): number {
  return level === "NOT_STARTED" ? 0 : Math.round(score);
}

/** Next practice difficulty: increase gradually as accuracy improves. */
export function recommendedDifficulty(score: number, recent: number[]): "EASY" | "MEDIUM" | "HARD" {
  const improving = recent.length >= 3 && recent[recent.length - 1] >= recent[recent.length - 3];
  if (score >= 80 && improving) return "HARD";
  if (score >= 55) return "MEDIUM";
  return "EASY";
}

export interface Recommendation {
  topicId: string;
  topicName: string;
  priority: number;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  reason: string;
}

/** Explainable recommendations — every suggestion carries a human-readable reason. */
export function recommend(
  topics: { topicId: string; topicName: string; accuracy: number; masteryScore: number; totalAttempts: number; recentScores: number[]; repeatedErrors: Record<string, number> }[],
): Recommendation[] {
  const out: Recommendation[] = [];
  for (const t of topics) {
    if (t.totalAttempts === 0) continue;
    const reasons: string[] = [];
    let priority = 0;
    if (t.accuracy < 60) {
      reasons.push(`accuracy is ${Math.round(t.accuracy)}% (below 60%)`);
      priority += 60 - t.accuracy + 20;
    }
    const [topError, n] = Object.entries(t.repeatedErrors).sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
    if (topError && n >= 2) {
      reasons.push(`${n} repeated ${topError} mistakes`);
      priority += n * 5;
    }
    const r = t.recentScores;
    if (r.length >= 2 && r[r.length - 1] < r[r.length - 2] - 10) {
      reasons.push("the latest score dropped");
      priority += 10;
    }
    const difficulty = recommendedDifficulty(t.masteryScore, r);
    if (!reasons.length && t.masteryScore >= 80) {
      reasons.push("strong recent results — ready for harder questions");
      priority += 1;
    }
    if (reasons.length) out.push({ topicId: t.topicId, topicName: t.topicName, priority, difficulty, reason: reasons.join("; ") });
  }
  return out.sort((a, b) => b.priority - a.priority);
}
