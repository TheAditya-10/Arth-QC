import "server-only";
import { aiProvider, models } from ".";
import { FEEDBACK_SYSTEM, PROMPT_VERSIONS } from "./prompts";
import { feedbackSchema } from "./schemas";
import type { EvalContext } from "./types";
import type { GradedQuestion } from "./evaluation.service";
import type { ExtractionResult } from "./extraction.service";
import type { QuestionFeedback } from "@/lib/db/schema";

export interface QuestionFeedbackResult {
  explanation: string;
  feedback: QuestionFeedback | null;
  recommendedPractice: string[];
}

/** Stage 5 — student-friendly feedback for every incorrect or partly-correct answer. */
export async function generateFeedback(
  ctx: EvalContext,
  graded: GradedQuestion[],
  extraction: ExtractionResult,
): Promise<{ byNumber: Map<number, QuestionFeedbackResult>; suggestedPractice: string[] }> {
  const byNumber = new Map<number, QuestionFeedbackResult>();
  for (const g of graded) {
    if (g.result === "CORRECT") byNumber.set(g.number, { explanation: "Well done — your working and answer are correct.", feedback: null, recommendedPractice: [] });
  }
  const wrong = graded.filter((g) => g.result !== "CORRECT");
  if (!wrong.length) return { byNumber, suggestedPractice: [] };

  const text = wrong
    .map((g) => {
      const q = ctx.questions.find((x) => x.number === g.number)!;
      const ex = extraction.byNumber.get(g.number);
      return `Q${g.number}: ${q.text}\nExpected answer: ${q.expectedAnswer}\nStudent wrote: ${ex?.finalAnswer ?? "(no answer)"}${ex?.steps.length ? `\nStudent steps: ${ex.steps.join(" | ")}` : ""}\nMarks: ${g.awarded}/${g.max}\nMistake: ${g.mistakeTypes.join(", ") || "none recorded"} — ${g.mistakeDescription ?? ""}`;
    })
    .join("\n\n");
  try {
    const { data } = await aiProvider().generateJson({
      purpose: "feedback",
      model: models().fast,
      promptVersion: PROMPT_VERSIONS.feedback,
      system: FEEDBACK_SYSTEM,
      schema: feedbackSchema,
      temperature: 0.4,
      referenceId: ctx.submissionId,
      parts: [{ text: `Topic: ${ctx.topic} (Class ${ctx.grade}).\n\n${text}` }],
      mockContext: { questions: wrong.map((g) => ({ number: g.number, text: ctx.questions.find((q) => q.number === g.number)!.text, expectedAnswer: ctx.questions.find((q) => q.number === g.number)!.expectedAnswer })) },
    });
    for (const f of data.questions) {
      if (!wrong.some((g) => g.number === f.question_number)) continue; // unsupported reference
      byNumber.set(f.question_number, {
        explanation: f.explanation,
        feedback: { whatWentWrong: f.what_went_wrong, whyIncorrect: f.why_incorrect, correctApproach: f.correct_approach, howToAvoid: f.how_to_avoid, example: f.example },
        recommendedPractice: f.recommended_practice.slice(0, 3),
      });
    }
    fillMissing(wrong, byNumber, ctx);
    return { byNumber, suggestedPractice: data.suggested_practice };
  } catch (e) {
    // Feedback is helpful but not essential — never fail an evaluation because of it.
    console.error("[ai] feedback generation failed; using fallback", e);
    fillMissing(wrong, byNumber, ctx);
    return { byNumber, suggestedPractice: [] };
  }
}

function fillMissing(wrong: GradedQuestion[], byNumber: Map<number, QuestionFeedbackResult>, ctx: EvalContext) {
  for (const g of wrong) {
    if (byNumber.has(g.number)) continue;
    const q = ctx.questions.find((x) => x.number === g.number)!;
    byNumber.set(g.number, {
      explanation: g.mistakeDescription ? `${g.mistakeDescription} The expected answer is ${q.expectedAnswer}.` : `The expected answer is ${q.expectedAnswer}. Compare it with your working step by step.`,
      feedback: null,
      recommendedPractice: [],
    });
  }
}
