/**
 * Structured-output schemas for every AI stage (zod v4 → JSON Schema for Gemini).
 * Every model response is parsed with these before anything touches the database.
 */
import { z } from "zod/v4";

const confidence = z.number().min(0).max(1);
const accuracy = z.enum(["STRONG", "ADEQUATE", "NEEDS_IMPROVEMENT", "NOT_DEMONSTRATED"]);

// ---- Stage 1: handwriting extraction ----
export const extractionSchema = z.object({
  pages_readable: z.boolean(),
  questions: z.array(
    z.object({
      question_number: z.number().int().min(1),
      recognized_expression: z.string().nullable(),
      student_steps: z.array(z.string()),
      final_answer: z.string().nullable(),
      crossed_out_work: z.array(z.string()),
      unreadable_sections: z.array(z.string()),
      answer_present: z.boolean(),
      confidence,
      needs_review: z.boolean(),
    }),
  ),
  general_notes: z.array(z.string()),
});
export type Extraction = z.infer<typeof extractionSchema>;

// ---- Stage 2: expected solution & rubric ----
export const rubricSchema = z.object({
  questions: z.array(
    z.object({
      question_number: z.number().int().min(1),
      correct_answer: z.string().min(1),
      expected_solution: z.string(),
      valid_methods: z.array(z.string()),
      rubric: z.array(z.object({ description: z.string().min(2), marks: z.number().positive() })).min(1),
    }),
  ),
});
export type RubricOutput = z.infer<typeof rubricSchema>;

// ---- Stage 3/4: evaluation & step-wise marking ----
export const evaluationSchema = z.object({
  questions: z.array(
    z.object({
      question_number: z.number().int().min(1),
      awarded_marks: z.number().min(0),
      status: z.enum(["correct", "partial", "incorrect", "unanswered"]),
      concept_understanding: accuracy,
      calculation_accuracy: accuracy,
      final_answer_status: z.enum(["CORRECT", "INCORRECT", "MISSING", "UNREADABLE"]),
      step_results: z.array(
        z.object({
          rubric_index: z.number().int().min(0),
          step: z.string(),
          marks: z.number().min(0),
          maximum_marks: z.number().positive(),
          status: z.enum(["CORRECT", "PARTIAL", "INCORRECT", "MISSING"]),
          comment: z.string().nullable(),
        }),
      ),
      mistake_types: z.array(z.enum(["conceptual", "calculation", "incomplete", "notation", "method", "misread"])),
      mistake_description: z.string().nullable(),
      used_alternative_method: z.boolean(),
      confidence,
      needs_review: z.boolean(),
    }),
  ),
  summary: z.string(),
  strengths: z.array(z.string()),
  needs_attention: z.array(z.string()),
});
export type EvaluationOutput = z.infer<typeof evaluationSchema>;

// ---- Stage 5: student-friendly feedback ----
export const feedbackSchema = z.object({
  questions: z.array(
    z.object({
      question_number: z.number().int().min(1),
      explanation: z.string().min(1),
      what_went_wrong: z.string(),
      why_incorrect: z.string(),
      correct_approach: z.string(),
      how_to_avoid: z.string(),
      example: z.string(),
      recommended_practice: z.array(z.string()).min(1).max(3),
    }),
  ),
  suggested_practice: z.array(z.string()).max(5),
});
export type FeedbackOutput = z.infer<typeof feedbackSchema>;

// ---- Question generation (homework + practice) ----
export const generatedQuestionsSchema = z.object({
  title: z.string().min(3),
  description: z.string(),
  questions: z
    .array(
      z.object({
        question_text: z.string().min(5),
        expected_answer: z.string().min(1),
        accepted_answers: z.array(z.string()),
        expected_solution: z.string(),
        hint: z.string(),
        difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
        marks: z.number().int().positive(),
        rubric: z.array(z.object({ description: z.string().min(2), marks: z.number().positive() })).min(1),
      }),
    )
    .min(1),
});
export type GeneratedQuestions = z.infer<typeof generatedQuestionsSchema>;

// ---- Answer equivalence judge (non-numeric practice answers) ----
export const answerJudgeSchema = z.object({ equivalent: z.boolean(), confidence });
export type AnswerJudge = z.infer<typeof answerJudgeSchema>;

export function toGeminiSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

// ---- Final evaluation result (what gets persisted), validated before any write ----
export const finalQuestionResultSchema = z.object({
  submissionId: z.string().uuid(),
  questionId: z.string().uuid(),
  extractedAnswer: z.string(),
  extractedSteps: z.array(z.string()),
  expectedAnswer: z.string().min(1),
  maximumMarks: z.number().positive(),
  awardedMarks: z.number().min(0),
  conceptAccuracy: accuracy,
  calculationAccuracy: accuracy,
  finalAnswerStatus: z.enum(["CORRECT", "INCORRECT", "MISSING", "UNREADABLE"]),
  stepResults: z
    .array(z.object({ description: z.string(), awarded: z.number().min(0), max: z.number().positive(), status: z.enum(["CORRECT", "PARTIAL", "INCORRECT", "MISSING"]) }))
    .min(1),
  mistakeClassification: z.array(z.string()),
  explanation: z.string().min(1),
  recommendedPractice: z.array(z.string()),
  confidence,
  reviewRequired: z.boolean(),
}).refine((r) => r.awardedMarks <= r.maximumMarks + 0.01, { message: "awardedMarks exceeds maximumMarks" })
  .refine((r) => Math.abs(r.stepResults.reduce((s, x) => s + x.awarded, 0) - r.awardedMarks) <= 0.01, { message: "step marks do not add up to awardedMarks" })
  .refine((r) => r.stepResults.every((s) => s.awarded <= s.max + 0.01), { message: "a step exceeds its maximum" });
export type FinalQuestionResult = z.infer<typeof finalQuestionResultSchema>;
