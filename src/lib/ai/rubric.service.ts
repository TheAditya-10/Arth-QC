import "server-only";
import { aiProvider, models } from ".";
import { PROMPT_VERSIONS, RUBRIC_SYSTEM } from "./prompts";
import { rubricSchema } from "./schemas";
import { MARK_EPSILON, sumMarks, type EvalContext, type EvalQuestion, type RubricStepInput } from "./types";
import { equivalentAnswers } from "@/lib/math/exact";

export interface EstablishedRubric {
  questionId: string;
  steps: RubricStepInput[];
  alternativeMethods: string[];
  expectedSolution: string;
  source: "PARENT" | "AI_GENERATED";
  generated: boolean;
  model: string | null;
  /** AI's correct answer disagreed with the parent's expected answer. */
  answerConflict: boolean;
}

/** Default when generation fails: half for method, half for the final answer. */
export function fallbackRubric(maxMarks: number): RubricStepInput[] {
  const method = Math.round(maxMarks * 0.5 * 2) / 2;
  return [
    { description: "Correct method and working", marks: method },
    { description: "Correct final answer", marks: Math.round((maxMarks - method) * 100) / 100 },
  ].filter((s) => s.marks > 0);
}

export function rubricIsValid(steps: RubricStepInput[], maxMarks: number) {
  return steps.length > 0 && steps.every((s) => s.marks > 0) && Math.abs(sumMarks(steps) - maxMarks) <= MARK_EPSILON;
}

/**
 * Stage 2 — establish expected solutions and rubrics. Parent-supplied rubrics win;
 * otherwise generate one and validate that its marks add up to the question maximum.
 */
export async function establishRubrics(ctx: EvalContext): Promise<EstablishedRubric[]> {
  const out = new Map<string, EstablishedRubric>();
  const missing: EvalQuestion[] = [];
  for (const q of ctx.questions) {
    if (q.rubric && rubricIsValid(q.rubric.steps, q.maxMarks)) {
      out.set(q.id, {
        questionId: q.id,
        steps: q.rubric.steps,
        alternativeMethods: q.rubric.alternativeMethods,
        expectedSolution: q.expectedSolution ?? "",
        source: q.rubric.source,
        generated: false,
        model: null,
        answerConflict: false,
      });
    } else missing.push(q);
  }
  if (missing.length) {
    let pending = missing;
    for (let round = 0; round < 2 && pending.length; round++) {
      const generated = await generate(ctx, pending, round > 0);
      const stillBad: EvalQuestion[] = [];
      for (const q of pending) {
        const g = generated.data.questions.find((x) => x.question_number === q.number);
        if (g && rubricIsValid(g.rubric, q.maxMarks)) {
          const conflict = equivalentAnswers(g.correct_answer, q.expectedAnswer) === false;
          out.set(q.id, {
            questionId: q.id,
            steps: g.rubric,
            alternativeMethods: g.valid_methods,
            expectedSolution: q.expectedSolution || g.expected_solution,
            source: "AI_GENERATED",
            generated: true,
            model: generated.model,
            answerConflict: conflict,
          });
        } else stillBad.push(q);
      }
      pending = stillBad;
    }
    for (const q of pending) {
      out.set(q.id, {
        questionId: q.id,
        steps: fallbackRubric(q.maxMarks),
        alternativeMethods: [],
        expectedSolution: q.expectedSolution ?? "",
        source: "AI_GENERATED",
        generated: true,
        model: null,
        answerConflict: false,
      });
    }
  }
  return ctx.questions.map((q) => out.get(q.id)!);
}

async function generate(ctx: EvalContext, qs: EvalQuestion[], strict: boolean) {
  const lines = qs
    .map((q) => `Q${q.number} (maximum ${q.maxMarks} marks): ${q.text}\nParent's expected answer: ${q.expectedAnswer}${q.expectedSolution ? `\nParent's solution: ${q.expectedSolution}` : ""}`)
    .join("\n\n");
  return aiProvider().generateJson({
    purpose: "rubric",
    model: models().evaluation,
    promptVersion: PROMPT_VERSIONS.rubric,
    system: RUBRIC_SYSTEM,
    schema: rubricSchema,
    temperature: 0.1,
    referenceId: ctx.submissionId,
    parts: [
      {
        text: `Class ${ctx.grade} ${ctx.subject} — ${ctx.topic}.${ctx.markingScheme ? `\nParent's marking scheme (takes priority): ${ctx.markingScheme}` : ""}\n\n${lines}${
          strict ? "\n\nIMPORTANT: your previous rubric marks did not add up to the maximum. Each rubric's marks MUST sum exactly to the question maximum." : ""
        }`,
      },
    ],
    mockContext: { questions: qs.map((q) => ({ number: q.number, text: q.text, maxMarks: q.maxMarks, expectedAnswer: q.expectedAnswer })) },
  });
}
