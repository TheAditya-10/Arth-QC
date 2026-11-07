import "server-only";
import { aiProvider, models } from ".";
import { PROMPT_VERSIONS, EXTRACTION_SYSTEM } from "./prompts";
import { extractionSchema, type Extraction } from "./schemas";
import type { EvalContext } from "./types";

export interface ExtractedQuestion {
  number: number;
  steps: string[];
  finalAnswer: string | null;
  answerPresent: boolean;
  confidence: number;
  needsReview: boolean;
  unreadable: string[];
  crossedOut: string[];
}

export interface ExtractionResult {
  raw: Extraction;
  byNumber: Map<number, ExtractedQuestion>;
  reviewReasons: string[];
  model: string;
}

/** Below this, a transcription is not trusted enough to auto-grade. */
export const EXTRACTION_REVIEW_CONFIDENCE = 0.6;

/**
 * Stage 1 — handwriting extraction, question identification and solution extraction
 * from notebook images/PDFs in one multimodal call.
 */
export async function extractHandwriting(ctx: EvalContext): Promise<ExtractionResult> {
  const provider = aiProvider();
  const fileParts = await provider.filesToParts(ctx.files);
  const questionList = ctx.questions.map((q) => `Q${q.number}. ${q.text}`).join("\n");
  const { data, model } = await provider.generateJson({
    purpose: "extraction",
    model: models().extraction,
    promptVersion: PROMPT_VERSIONS.extraction,
    system: EXTRACTION_SYSTEM,
    schema: extractionSchema,
    temperature: 0,
    referenceId: ctx.submissionId,
    parts: [
      { text: `Assignment: ${ctx.assignmentTitle} (Class ${ctx.grade} ${ctx.subject}, topic: ${ctx.topic}).\nQuestions:\n${questionList}\n\nThe student's notebook pages follow (${ctx.files.length} file(s)). Transcribe their answers.` },
      ...fileParts,
    ],
    mockContext: { seed: ctx.submissionId, questions: ctx.questions.map((q) => ({ number: q.number, text: q.text, maxMarks: q.maxMarks, expectedAnswer: q.expectedAnswer })) },
  });
  return normaliseExtraction(data, ctx.questions.map((q) => q.number), model);
}

/** Question identification: map to known questions, drop unsupported references, fill gaps. */
export function normaliseExtraction(raw: Extraction, validNumbers: number[], model: string): ExtractionResult {
  const valid = new Set(validNumbers);
  const byNumber = new Map<number, ExtractedQuestion>();
  const reviewReasons: string[] = [];
  if (!raw.pages_readable) reviewReasons.push("Some notebook pages could not be read clearly.");
  for (const q of raw.questions) {
    if (!valid.has(q.question_number)) {
      reviewReasons.push(`Ignored an answer labelled Q${q.question_number}, which is not part of this assignment.`);
      continue;
    }
    const prev = byNumber.get(q.question_number);
    if (prev) reviewReasons.push(`Q${q.question_number} appeared more than once in the notebook.`);
    if (prev && prev.confidence >= q.confidence) continue;
    const needsReview = q.needs_review || q.confidence < EXTRACTION_REVIEW_CONFIDENCE || q.unreadable_sections.length > 0;
    byNumber.set(q.question_number, {
      number: q.question_number,
      steps: q.student_steps.map((s) => s.trim()).filter(Boolean).slice(0, 30),
      finalAnswer: q.answer_present && q.final_answer?.trim() ? q.final_answer.trim() : null,
      answerPresent: q.answer_present && Boolean(q.final_answer?.trim()),
      confidence: q.confidence,
      needsReview,
      unreadable: q.unreadable_sections,
      crossedOut: q.crossed_out_work,
    });
  }
  for (const n of validNumbers) {
    if (!byNumber.has(n)) byNumber.set(n, { number: n, steps: [], finalAnswer: null, answerPresent: false, confidence: 1, needsReview: false, unreadable: [], crossedOut: [] });
  }
  return { raw, byNumber, reviewReasons, model };
}
