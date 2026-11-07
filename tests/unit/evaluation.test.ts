import { describe, expect, it } from "vitest";
import { validateGrading, verifyQuestion } from "@/lib/ai/evaluation.service";
import { normaliseExtraction } from "@/lib/ai/extraction.service";
import { fallbackRubric, rubricIsValid } from "@/lib/ai/rubric.service";
import { evaluationSchema, extractionSchema, finalQuestionResultSchema } from "@/lib/ai/schemas";
import type { EvalContext } from "@/lib/ai/types";

const ctx: EvalContext = {
  submissionId: "00000000-0000-4000-8000-000000000001",
  grade: 6,
  subject: "Mathematics",
  topic: "Fractions",
  assignmentTitle: "Fractions",
  allowAlternativeMethods: true,
  learningContext: [],
  files: [],
  questions: [{ id: "00000000-0000-4000-8000-0000000000a1", number: 1, text: "Add 3/4 and 1/2", maxMarks: 10, expectedAnswer: "5/4", expectedSolution: null, rubric: null }],
};
const rubrics = [
  {
    questionId: ctx.questions[0].id,
    steps: [
      { description: "Identify common denominator", marks: 2 },
      { description: "Convert fractions", marks: 3 },
      { description: "Add numerators", marks: 3 },
      { description: "Simplify / final answer", marks: 2 },
    ],
    alternativeMethods: [],
    expectedSolution: "",
    source: "PARENT" as const,
    generated: false,
    model: null,
    answerConflict: false,
  },
];

function grading(over: Partial<Record<string, unknown>> = {}, steps?: { rubric_index: number; marks: number; maximum_marks: number }[]) {
  const st = (steps ?? [
    { rubric_index: 0, marks: 0, maximum_marks: 2 },
    { rubric_index: 1, marks: 0, maximum_marks: 3 },
    { rubric_index: 2, marks: 0, maximum_marks: 3 },
    { rubric_index: 3, marks: 0, maximum_marks: 2 },
  ]).map((s) => ({ ...s, step: "x", status: "INCORRECT" as const, comment: null }));
  return evaluationSchema.parse({
    summary: "",
    strengths: [],
    needs_attention: [],
    questions: [
      {
        question_number: 1,
        awarded_marks: st.reduce((a, s) => a + s.marks, 0),
        status: "incorrect",
        concept_understanding: "NEEDS_IMPROVEMENT",
        calculation_accuracy: "NEEDS_IMPROVEMENT",
        final_answer_status: "INCORRECT",
        step_results: st,
        mistake_types: ["conceptual"],
        mistake_description: "Added numerators and denominators.",
        used_alternative_method: false,
        confidence: 0.9,
        needs_review: false,
        ...over,
      },
    ],
  });
}

describe("grading validation (rejects inconsistent model output)", () => {
  it("accepts a consistent step-wise marking", () => {
    expect(validateGrading(grading(), ctx, rubrics)).toEqual([]);
  });
  it("rejects totals that don't add up", () => {
    expect(validateGrading(grading({ awarded_marks: 5 }), ctx, rubrics).join(" ")).toMatch(/does not equal the sum/);
  });
  it("rejects marks above a step maximum and wrong step maxima", () => {
    const g = grading({}, [
      { rubric_index: 0, marks: 3, maximum_marks: 2 },
      { rubric_index: 1, marks: 0, maximum_marks: 4 },
      { rubric_index: 2, marks: 0, maximum_marks: 3 },
      { rubric_index: 3, marks: 0, maximum_marks: 2 },
    ]);
    const p = validateGrading(g, ctx, rubrics).join(" ");
    expect(p).toMatch(/awards more than its maximum/);
    expect(p).toMatch(/maximum must be 3/);
  });
  it("rejects unsupported and missing question references", () => {
    const g = grading({ question_number: 7 });
    const p = validateGrading(g, ctx, rubrics).join(" ");
    expect(p).toMatch(/Q7 is not a question/);
    expect(p).toMatch(/Q1 is missing/);
  });
  it("rejects awarded marks above the question maximum", () => {
    expect(validateGrading(grading({ awarded_marks: 12 }), ctx, rubrics).join(" ")).toMatch(/exceeds the maximum/);
  });
});

describe("deterministic verification vs AI", () => {
  it("agrees when both say incorrect (3/4 + 1/2 = 4/6)", () => {
    const v = verifyQuestion("5/4", "4/6", ["3/4 + 1/2 = 4/6"], "INCORRECT");
    expect(v.method).toBe("deterministic");
    expect(v.disagreement).toBe(false);
    expect(v.stepChecks?.[0].valid).toBe(false);
  });
  it("flags disagreement when the AI calls a wrong answer correct", () => {
    expect(verifyQuestion("5/4", "4/6", [], "CORRECT").disagreement).toBe(true);
  });
  it("flags disagreement when the AI rejects an equivalent answer", () => {
    expect(verifyQuestion("5/4", "1 1/4", [], "INCORRECT").disagreement).toBe(true);
    expect(verifyQuestion("5/4", "1.25", [], "INCORRECT").disagreement).toBe(true);
  });
  it("does not judge word answers deterministically", () => {
    expect(verifyQuestion("acute", "obtuse", [], "INCORRECT").method).toBe("not_applicable");
  });
});

describe("handwriting extraction normalisation", () => {
  const raw = extractionSchema.parse({
    pages_readable: true,
    general_notes: [],
    questions: [
      { question_number: 1, recognized_expression: null, student_steps: ["3/4 + 1/2", "4/6"], final_answer: "4/6", crossed_out_work: [], unreadable_sections: [], answer_present: true, confidence: 0.96, needs_review: false },
      { question_number: 9, recognized_expression: null, student_steps: [], final_answer: "12", crossed_out_work: [], unreadable_sections: [], answer_present: true, confidence: 0.9, needs_review: false },
      { question_number: 2, recognized_expression: null, student_steps: ["2?"], final_answer: "2?", crossed_out_work: [], unreadable_sections: ["second digit unclear"], answer_present: true, confidence: 0.4, needs_review: false },
    ],
  });
  const r = normaliseExtraction(raw, [1, 2, 3], "test");
  it("keeps known questions and drops unsupported references with a reason", () => {
    expect(r.byNumber.get(1)?.finalAnswer).toBe("4/6");
    expect(r.byNumber.has(9)).toBe(false);
    expect(r.reviewReasons.join(" ")).toMatch(/Q9/);
  });
  it("marks ambiguous handwriting for review instead of trusting it", () => {
    expect(r.byNumber.get(2)?.needsReview).toBe(true);
  });
  it("fills unanswered questions", () => {
    expect(r.byNumber.get(3)).toMatchObject({ answerPresent: false, finalAnswer: null });
  });
});

describe("rubrics", () => {
  it("validates totals", () => {
    expect(rubricIsValid(rubrics[0].steps, 10)).toBe(true);
    expect(rubricIsValid(rubrics[0].steps, 9)).toBe(false);
  });
  it("produces a valid fallback for any maximum", () => {
    for (const m of [1, 3, 5, 7.5, 10]) expect(rubricIsValid(fallbackRubric(m), m)).toBe(true);
  });
});

describe("final result schema", () => {
  const base = {
    submissionId: ctx.submissionId,
    questionId: ctx.questions[0].id,
    extractedAnswer: "4/6",
    extractedSteps: [],
    expectedAnswer: "5/4",
    maximumMarks: 10,
    awardedMarks: 2,
    conceptAccuracy: "NEEDS_IMPROVEMENT",
    calculationAccuracy: "ADEQUATE",
    finalAnswerStatus: "INCORRECT",
    stepResults: [
      { description: "a", awarded: 2, max: 5, status: "PARTIAL" },
      { description: "b", awarded: 0, max: 5, status: "INCORRECT" },
    ],
    mistakeClassification: ["conceptual"],
    explanation: "…",
    recommendedPractice: [],
    confidence: 0.9,
    reviewRequired: false,
  };
  it("accepts consistent results and rejects inconsistent totals", () => {
    expect(finalQuestionResultSchema.safeParse(base).success).toBe(true);
    expect(finalQuestionResultSchema.safeParse({ ...base, awardedMarks: 5 }).success).toBe(false);
    expect(finalQuestionResultSchema.safeParse({ ...base, awardedMarks: 11, maximumMarks: 10 }).success).toBe(false);
  });
});
