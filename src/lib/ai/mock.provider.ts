import "server-only";
import type { z } from "zod/v4";
import { equivalentAnswers } from "@/lib/math/exact";
import type { AIJsonRequest, AIProvider, AIResult, AITextRequest } from "./provider";
import type { EvaluationOutput, Extraction, FeedbackOutput, GeneratedQuestions, RubricOutput } from "./schemas";
import { PRACTICE_BANK } from "@/lib/mock-data/practice-bank";

/**
 * Deterministic offline provider (AI_PROVIDER=mock). It cannot read handwriting, so
 * it simulates a plausible transcription from the assignment context. Its output
 * goes through exactly the same schema validation and consistency checks as Gemini.
 */
export interface MockQuestionCtx {
  number: number;
  text: string;
  maxMarks: number;
  expectedAnswer: string;
  rubric?: { description: string; marks: number }[];
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function splitMarks(max: number): { description: string; marks: number }[] {
  const method = Math.round((max / 2) * 2) / 2;
  return [
    { description: "Correct method and working", marks: method },
    { description: "Correct final answer", marks: max - method },
  ].filter((s) => s.marks > 0);
}

function mockExtraction(ctx: { questions: MockQuestionCtx[]; seed: string }): Extraction {
  return {
    pages_readable: true,
    general_notes: ["Simulated transcription (mock AI provider)."],
    questions: ctx.questions.map((q) => {
      const r = hash(ctx.seed + q.number) % 10;
      const wrong = r >= 7; // ~30% of answers simulated as wrong
      const final = wrong ? `${q.expectedAnswer.split(/[;=]/)[0].trim()} (?)` : q.expectedAnswer;
      return {
        question_number: q.number,
        recognized_expression: q.text.slice(0, 80),
        student_steps: [final],
        final_answer: final,
        crossed_out_work: [],
        unreadable_sections: [],
        answer_present: true,
        confidence: wrong ? 0.82 : 0.95,
        needs_review: false,
      };
    }),
  };
}

function mockRubric(ctx: { questions: MockQuestionCtx[] }): RubricOutput {
  return {
    questions: ctx.questions.map((q) => ({
      question_number: q.number,
      correct_answer: q.expectedAnswer,
      expected_solution: `Work step by step to reach ${q.expectedAnswer}.`,
      valid_methods: ["Standard NCERT method"],
      rubric: splitMarks(q.maxMarks),
    })),
  };
}

function mockEvaluation(ctx: { questions: (MockQuestionCtx & { studentAnswer: string | null })[] }): EvaluationOutput {
  return {
    summary: "Simulated evaluation (mock AI provider).",
    strengths: ["Clear step-by-step working"],
    needs_attention: [],
    questions: ctx.questions.map((q) => {
      const rubric = q.rubric?.length ? q.rubric : splitMarks(q.maxMarks);
      const answered = Boolean(q.studentAnswer);
      const eq = answered ? equivalentAnswers(q.studentAnswer!, q.expectedAnswer) : false;
      const correct = eq === true || (eq === null && q.studentAnswer?.trim().toLowerCase() === q.expectedAnswer.trim().toLowerCase());
      const steps = rubric.map((s, i) => {
        const last = i === rubric.length - 1;
        const marks = correct ? s.marks : !answered ? 0 : last ? 0 : s.marks;
        return { rubric_index: i, step: s.description, marks, maximum_marks: s.marks, status: (marks === s.marks ? "CORRECT" : marks === 0 ? (answered ? "INCORRECT" : "MISSING") : "PARTIAL") as "CORRECT" | "PARTIAL" | "INCORRECT" | "MISSING", comment: null };
      });
      const awarded = steps.reduce((s, x) => s + x.marks, 0);
      return {
        question_number: q.number,
        awarded_marks: awarded,
        status: !answered ? "unanswered" : correct ? "correct" : awarded > 0 ? "partial" : "incorrect",
        concept_understanding: correct ? "STRONG" : "ADEQUATE",
        calculation_accuracy: correct ? "STRONG" : "NEEDS_IMPROVEMENT",
        final_answer_status: !answered ? "MISSING" : correct ? "CORRECT" : "INCORRECT",
        step_results: steps,
        mistake_types: correct ? [] : answered ? ["calculation"] : ["incomplete"],
        mistake_description: correct ? null : answered ? "The final answer does not match the expected answer." : "No answer was written.",
        used_alternative_method: false,
        confidence: 0.9,
        needs_review: false,
      };
    }),
  };
}

function mockFeedback(ctx: { questions: { number: number; text: string; expectedAnswer: string }[] }): FeedbackOutput {
  return {
    suggested_practice: ctx.questions.slice(0, 3).map((q) => `Try a question like: ${q.text.slice(0, 60)}`),
    questions: ctx.questions.map((q) => ({
      question_number: q.number,
      explanation: `Your method was a good start, but the final answer should be ${q.expectedAnswer}. Check each step slowly.`,
      what_went_wrong: "The last step gave a different answer.",
      why_incorrect: `The correct answer is ${q.expectedAnswer}.`,
      correct_approach: "Write each step on a new line and check the calculation before moving on.",
      how_to_avoid: "Re-check your final calculation once before you finish.",
      example: "For example, 12 × 15 = 12 × 10 + 12 × 5 = 120 + 60 = 180.",
      recommended_practice: [`Practise another question on: ${q.text.slice(0, 50)}`, "Try one more similar question with different numbers."],
    })),
  };
}

function mockGeneration(ctx: { topicCode: string; difficulty: "EASY" | "MEDIUM" | "HARD"; count: number; marksEach: number; topicName: string }): GeneratedQuestions {
  const d = ctx.difficulty.toLowerCase();
  const pool = [
    ...PRACTICE_BANK.filter((q) => q.topicId === ctx.topicCode && q.difficulty === d),
    ...PRACTICE_BANK.filter((q) => q.topicId === ctx.topicCode && q.difficulty !== d),
  ];
  const picked = (pool.length ? pool : PRACTICE_BANK).slice(0, ctx.count);
  return {
    title: `${ctx.topicName} practice`,
    description: `${picked.length} ${d} questions on ${ctx.topicName}.`,
    questions: picked.map((q) => ({
      question_text: q.text,
      expected_answer: q.answer,
      accepted_answers: q.accepts ?? [],
      expected_solution: q.explanation,
      hint: q.hint,
      difficulty: ctx.difficulty,
      marks: ctx.marksEach,
      rubric: splitMarks(ctx.marksEach),
    })),
  };
}

export function createMockProvider(): AIProvider {
  return {
    name: "mock",
    async generateJson<S extends z.ZodType>(req: AIJsonRequest<S>): Promise<AIResult<z.infer<S>>> {
      const ctx = req.mockContext as never;
      let out: unknown;
      switch (req.purpose) {
        case "extraction":
          out = mockExtraction(ctx);
          break;
        case "rubric":
          out = mockRubric(ctx);
          break;
        case "evaluation":
          out = mockEvaluation(ctx);
          break;
        case "feedback":
          out = mockFeedback(ctx);
          break;
        case "generation":
        case "practice":
          out = mockGeneration(ctx);
          break;
        case "judge": {
          const c = ctx as { answer: string; expected: string };
          out = { equivalent: c.answer.trim().toLowerCase() === c.expected.trim().toLowerCase(), confidence: 0.6 };
          break;
        }
        default:
          throw new Error(`mock: unsupported purpose ${req.purpose}`);
      }
      return { data: req.schema.parse(out) as z.infer<S>, model: "mock" };
    },
    async filesToParts() {
      return [];
    },
    async generateText(req: AITextRequest): Promise<AIResult<string>> {
      const last = req.history[req.history.length - 1]?.text.toLowerCase() ?? "";
      let reply = "Let's think about it together! What do you already know about this question? Tell me your first step and I'll give you a hint. 🦉";
      if (/answer/.test(last)) reply = "I won't give the answer straight away — you'll remember it better if you find it! **Hint:** start by writing what the question is asking, then try the first step.";
      if (/fraction/.test(last)) reply = "A fraction is a part of a whole. If a roti is cut into 4 equal pieces and you eat 1, you ate **1/4**. What fraction is left?";
      return { data: reply, model: "mock" };
    },
  };
}
