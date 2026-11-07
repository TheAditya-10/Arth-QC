import { describe, expect, it } from "vitest";
import { masteryLevel, masteryScore, recommend, recommendedDifficulty, weightedRecent } from "@/lib/services/progress/mastery";

describe("topic mastery", () => {
  it("weights recent scores more heavily", () => {
    expect(weightedRecent([40, 90])).toBeGreaterThan(65);
    expect(weightedRecent([90, 40])).toBeLessThan(65);
  });
  it("never reaches Mastered from a single perfect assignment", () => {
    const input = { recentScores: [100], totalAttempts: 5, previousMasteryScore: 0 };
    const score = masteryScore(input);
    expect(masteryLevel(score, input)).not.toBe("MASTERED");
  });
  it("reaches Mastered with consistent high scores over several attempts", () => {
    const input = { recentScores: [88, 92, 95, 90], totalAttempts: 16, previousMasteryScore: 80 };
    expect(masteryLevel(masteryScore(input), input)).toBe("MASTERED");
  });
  it("is Not Started with no attempts", () => {
    const input = { recentScores: [], totalAttempts: 0, previousMasteryScore: 0 };
    expect(masteryLevel(masteryScore(input), input)).toBe("NOT_STARTED");
  });
  it("increases difficulty gradually as accuracy improves", () => {
    expect(recommendedDifficulty(40, [30, 40])).toBe("EASY");
    expect(recommendedDifficulty(65, [50, 60, 65])).toBe("MEDIUM");
    expect(recommendedDifficulty(85, [70, 80, 90])).toBe("HARD");
  });
  it("explains recommendations and prioritises weak, error-prone topics", () => {
    const recs = recommend([
      { topicId: "a", topicName: "Fractions", accuracy: 45, masteryScore: 40, totalAttempts: 10, recentScores: [50, 40], repeatedErrors: { calculation: 3 } },
      { topicId: "b", topicName: "Integers", accuracy: 92, masteryScore: 88, totalAttempts: 12, recentScores: [85, 90, 92], repeatedErrors: {} },
      { topicId: "c", topicName: "Decimals", accuracy: 0, masteryScore: 0, totalAttempts: 0, recentScores: [], repeatedErrors: {} },
    ]);
    expect(recs[0].topicName).toBe("Fractions");
    expect(recs[0].reason).toMatch(/below 60%/);
    expect(recs[0].reason).toMatch(/3 repeated calculation mistakes/);
    expect(recs.find((r) => r.topicName === "Decimals")).toBeUndefined();
    expect(recs.find((r) => r.topicName === "Integers")?.difficulty).toBe("HARD");
  });
});
