import { describe, expect, it } from "vitest";
import { equivalentAnswers, evaluate, verifyStep, isVerifiable } from "@/lib/math/exact";

const v = (s: string) => evaluate(s)?.toString() ?? null;

describe("exact evaluation", () => {
  it("handles integers with Indian grouping", () => {
    expect(v("4,66,875")).toBe("466875");
    expect(v("₹4,66,875")).toBe("466875");
    expect(v("7,08,45,213")).toBe("70845213");
  });
  it("is exact for decimals (no floating point)", () => {
    expect(v("0.1 + 0.2")).toBe("3/10");
    expect(v("2.65 + 4.3")).toBe("139/20");
    expect(equivalentAnswers("6.95", "2.65 + 4.3")).toBe(true);
  });
  it("handles fractions, mixed numbers and percentages", () => {
    expect(v("3/4 + 1/2")).toBe("5/4");
    expect(v("2 1/3")).toBe("7/3");
    expect(v("-2 1/3")).toBe("-7/3");
    expect(v("50%")).toBe("1/2");
    expect(v("25% of 80")).toBe("20");
    expect(v("1/2 of 10")).toBe("5");
  });
  it("handles integers and operator precedence", () => {
    expect(v("(−6) + (−9) + 4")).toBe("-11");
    expect(v("3 − (−8)")).toBe("11");
    expect(v("4 × 1768 × 25")).toBe("176800");
    expect(v("100 - 2 × 3")).toBe("94");
    expect(v("854 x 102")).toBe("87108");
  });
  it("strips units", () => {
    expect(v("3,250 m")).toBe("3250");
    expect(v("170 litres")).toBe("170");
    expect(v("120°")).toBe("120");
  });
  it("returns null for non-numeric text instead of guessing", () => {
    expect(v("acute angle")).toBeNull();
    expect(v("No, 1 is the identity")).toBeNull();
    expect(v("1/0")).toBeNull();
  });
});

describe("answer equivalence", () => {
  it("recognises equivalent fractions", () => {
    expect(equivalentAnswers("6/8", "3/4")).toBe(true);
    expect(equivalentAnswers("4/6", "5/4")).toBe(false);
  });
  it("compares the final part of worked answers", () => {
    expect(equivalentAnswers("5,000 + 17,000 = 22,000", "5,000 + 18,000 = 23,000")).toBe(false);
    expect(equivalentAnswers("23000", "5,000 + 18,000 = 23,000")).toBe(true);
  });
  it("compares lists as multisets", () => {
    expect(equivalentAnswers("29, 23, 37, 31", "23, 29, 31, 37")).toBe(true);
    expect(equivalentAnswers("23, 29, 31, 33, 37", "23, 29, 31, 37")).toBe(false);
  });
  it("returns null when not verifiable", () => {
    expect(equivalentAnswers("acute", "obtuse")).toBeNull();
    expect(isVerifiable("Acute, right, obtuse, straight")).toBe(false);
    expect(isVerifiable("2 × 2 × 5 × 7 × 7")).toBe(true);
  });
});

describe("step verification", () => {
  it("flags calculation slips inside steps", () => {
    expect(verifyStep("854 × 2 = 1,608")).toBe(false);
    expect(verifyStep("854 × 100 + 854 × 2 = 85,400 + 1,708 = 87,108")).toBe(true);
    expect(verifyStep("3/4 + 1/2 = 4/6")).toBe(false);
    expect(verifyStep("Round 5,290 to 5,000")).toBeNull();
  });
});
