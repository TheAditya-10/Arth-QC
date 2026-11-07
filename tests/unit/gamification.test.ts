import { describe, expect, it } from "vitest";
import { effectiveStreak, nextStreak } from "@/lib/services/gamification/streak";
import { improvementPoints } from "@/lib/services/gamification/metrics";
import { DEFAULT_XP_RULES, levelFor, resolveRules, scoreBonusRule } from "@/lib/services/gamification/rules";

describe("streaks (timezone-local dates)", () => {
  const empty = { currentStreak: 0, longestStreak: 0, lastActivityDate: null };
  it("starts, continues and resets", () => {
    let s = nextStreak(empty, "2026-11-01");
    expect(s.currentStreak).toBe(1);
    s = nextStreak(s, "2026-11-02");
    s = nextStreak(s, "2026-11-03");
    expect(s).toMatchObject({ currentStreak: 3, longestStreak: 3 });
    s = nextStreak(s, "2026-11-05"); // gap
    expect(s).toMatchObject({ currentStreak: 1, longestStreak: 3 });
  });
  it("counts a day only once", () => {
    const s = nextStreak(nextStreak(empty, "2026-11-01"), "2026-11-01");
    expect(s.currentStreak).toBe(1);
  });
  it("handles month boundaries", () => {
    const s = nextStreak(nextStreak(empty, "2026-10-31"), "2026-11-01");
    expect(s.currentStreak).toBe(2);
  });
  it("shows a streak alive through today if yesterday was studied, broken afterwards", () => {
    const s = { currentStreak: 4, longestStreak: 6, lastActivityDate: "2026-11-06" };
    expect(effectiveStreak(s, "2026-11-06")).toBe(4);
    expect(effectiveStreak(s, "2026-11-07")).toBe(4);
    expect(effectiveStreak(s, "2026-11-08")).toBe(0);
  });
});

describe("XP rules", () => {
  it("awards only the highest score tier", () => {
    expect(scoreBonusRule(95)).toBe("SCORE_ABOVE_90");
    expect(scoreBonusRule(85)).toBe("SCORE_ABOVE_80");
    expect(scoreBonusRule(80)).toBeNull();
  });
  it("applies valid family overrides and ignores invalid ones", () => {
    const r = resolveRules({ HOMEWORK_COMPLETED: 40, SCORE_ABOVE_90: -5, BOGUS: 99, WEEKLY_CHALLENGE: 5000 });
    expect(r.HOMEWORK_COMPLETED).toBe(40);
    expect(r.SCORE_ABOVE_90).toBe(DEFAULT_XP_RULES.SCORE_ABOVE_90);
    expect(r.WEEKLY_CHALLENGE).toBe(DEFAULT_XP_RULES.WEEKLY_CHALLENGE);
    expect(Object.keys(r)).not.toContain("BOGUS");
  });
  it("computes levels", () => {
    expect(levelFor(0)).toBe(1);
    expect(levelFor(399)).toBe(1);
    expect(levelFor(400)).toBe(2);
  });
  it("measures improvement against the lowest earlier score", () => {
    expect(improvementPoints([52, 68, 82, 88, 75])).toBe(36);
    expect(improvementPoints([90, 70])).toBe(0);
    expect(improvementPoints([])).toBe(0);
  });
});
