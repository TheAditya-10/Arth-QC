/** Pure metric helpers used by achievements, rewards and dashboards. */

/** Largest gain of any score over the lowest earlier score (percentage points). */
export function improvementPoints(chronologicalPcts: number[]): number {
  let best = 0;
  let min = Infinity;
  for (const p of chronologicalPcts) {
    if (min !== Infinity) best = Math.max(best, p - min);
    min = Math.min(min, p);
  }
  return Math.round(best);
}

export function pct(score: number, max: number) {
  return max > 0 ? Math.round((score / max) * 1000) / 10 : 0;
}
