/** Pure display helpers over server data (scoring rules themselves live on the server). */
import type { Evaluation, PracticeResult } from "@/types";
import { pct } from "@/lib/utils";

export function bestScore(evals: Evaluation[], practice: PracticeResult[]): number {
  const e = evals.map((x) => pct(x.parentOverride?.score ?? x.score, x.maxScore));
  const p = practice.filter((r) => r.total >= 5).map((r) => pct(r.correct, r.total));
  return Math.max(0, ...e, ...p);
}

export function improvementPoints(evals: Evaluation[]): number {
  const pcts = [...evals].sort((a, b) => a.evaluatedAt.localeCompare(b.evaluatedAt)).map((e) => pct(e.parentOverride?.score ?? e.score, e.maxScore));
  let best = 0;
  let min = Infinity;
  for (const p of pcts) {
    if (min !== Infinity) best = Math.max(best, p - min);
    min = Math.min(min, p);
  }
  return best;
}
