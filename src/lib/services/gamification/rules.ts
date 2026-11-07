/**
 * Configurable XP rules. Families may override amounts via families.xp_rules.
 * The frontend never decides XP — every award goes through awardXp().
 */
export const DEFAULT_XP_RULES = {
  HOMEWORK_COMPLETED: 30,
  SCORE_ABOVE_80: 20,
  SCORE_ABOVE_90: 30,
  MISTAKE_CORRECTED: 15,
  PRACTICE_COMPLETED: 10,
  DAILY_CHALLENGE: 15,
  WEEKLY_CHALLENGE: 50,
} as const;

export type XpRuleKey = keyof typeof DEFAULT_XP_RULES;

/** Practice XP is capped per day to stop farming by spamming short sessions. */
export const PRACTICE_XP_DAILY_CAP = 5;

export function resolveRules(overrides: Partial<Record<string, number>> | null | undefined): Record<XpRuleKey, number> {
  const out = { ...DEFAULT_XP_RULES } as Record<XpRuleKey, number>;
  for (const k of Object.keys(out) as XpRuleKey[]) {
    const v = overrides?.[k];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1000) out[k] = Math.round(v);
  }
  return out;
}

/** Score bonus tier for a homework percentage (only the highest tier applies). */
export function scoreBonusRule(percentage: number): XpRuleKey | null {
  if (percentage > 90) return "SCORE_ABOVE_90";
  if (percentage > 80) return "SCORE_ABOVE_80";
  return null;
}

export const XP_PER_LEVEL = 400;
export function levelFor(xp: number) {
  return Math.floor(Math.max(0, xp) / XP_PER_LEVEL) + 1;
}
