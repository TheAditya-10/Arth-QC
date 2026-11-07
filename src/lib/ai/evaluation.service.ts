import "server-only";
import { aiProvider, models } from ".";
import { AIError } from "./provider";
import { EVALUATION_SYSTEM, PROMPT_VERSIONS } from "./prompts";
import { evaluationSchema, type EvaluationOutput } from "./schemas";
import { MARK_EPSILON, sumMarks, type EvalContext } from "./types";
import type { ExtractionResult } from "./extraction.service";
import type { EstablishedRubric } from "./rubric.service";
import { equivalentAnswers, isVerifiable, verifyStep } from "@/lib/math/exact";
import type { VerificationResult } from "@/lib/db/schema";

export interface GradedStep {
  position: number;
  description: string;
  awarded: number;
  max: number;
  status: "CORRECT" | "PARTIAL" | "INCORRECT" | "MISSING";
  comment: string | null;
}

export interface GradedQuestion {
  questionId: string;
  number: number;
  awarded: number;
  max: number;
  result: "CORRECT" | "PARTIAL" | "INCORRECT" | "UNANSWERED";
  conceptAccuracy: EvaluationOutput["questions"][number]["concept_understanding"];
  calculationAccuracy: EvaluationOutput["questions"][number]["calculation_accuracy"];
  finalAnswerStatus: EvaluationOutput["questions"][number]["final_answer_status"];
  mistakeTypes: string[];
  mistakeDescription: string | null;
  steps: GradedStep[];
  confidence: number;
  needsReview: boolean;
  verification: VerificationResult;
  reviewReasons: string[];
}

export interface GradingResult {
  questions: GradedQuestion[];
  summary: string;
  strengths: string[];
  needsAttention: string[];
  model: string;
}

/**
 * Semantic validation of a model's marking. Returns a list of problems (empty = valid):
 * unsupported/missing questions, step counts and maxima that don't match the rubric,
 * marks above maxima and totals that don't add up.
 */
export function validateGrading(out: EvaluationOutput, ctx: EvalContext, rubrics: EstablishedRubric[]): string[] {
  const problems: string[] = [];
  const seen = new Set<number>();
  for (const g of out.questions) {
    const qi = ctx.questions.findIndex((q) => q.number === g.question_number);
    if (qi === -1) {
      problems.push(`Q${g.question_number} is not a question in this assignment.`);
      continue;
    }
    if (seen.has(g.question_number)) problems.push(`Q${g.question_number} was graded twice.`);
    seen.add(g.question_number);
    const q = ctx.questions[qi];
    const rubric = rubrics[qi].steps;
    if (g.awarded_marks > q.maxMarks + MARK_EPSILON) problems.push(`Q${q.number}: awarded ${g.awarded_marks} exceeds the maximum ${q.maxMarks}.`);
    if (g.step_results.length !== rubric.length) problems.push(`Q${q.number}: expected ${rubric.length} step results (one per rubric step), got ${g.step_results.length}.`);
    const idx = new Set<number>();
    for (const s of g.step_results) {
      const r = rubric[s.rubric_index];
      if (!r) {
        problems.push(`Q${q.number}: rubric_index ${s.rubric_index} does not exist.`);
        continue;
      }
      if (idx.has(s.rubric_index)) problems.push(`Q${q.number}: rubric step ${s.rubric_index} graded twice.`);
      idx.add(s.rubric_index);
      if (Math.abs(s.maximum_marks - r.marks) > MARK_EPSILON) problems.push(`Q${q.number}: step ${s.rubric_index} maximum must be ${r.marks}.`);
      if (s.marks > r.marks + MARK_EPSILON) problems.push(`Q${q.number}: step ${s.rubric_index} awards more than its maximum.`);
    }
    const stepSum = sumMarks(g.step_results);
    if (Math.abs(stepSum - g.awarded_marks) > MARK_EPSILON) problems.push(`Q${q.number}: awarded_marks ${g.awarded_marks} does not equal the sum of step marks ${stepSum}.`);
  }
  for (const q of ctx.questions) if (!seen.has(q.number)) problems.push(`Q${q.number} is missing from the evaluation.`);
  return problems;
}

/**
 * Deterministic cross-check of the AI's verdict on the final answer, plus
 * arithmetic validity of each written step. Disagreement → needs review.
 */
export function verifyQuestion(
  expectedAnswer: string,
  studentFinal: string | null,
  studentSteps: string[],
  aiFinalStatus: GradedQuestion["finalAnswerStatus"],
): VerificationResult {
  const stepChecks = studentSteps.map((step) => ({ step, valid: verifyStep(step) }));
  if (!studentFinal || !isVerifiable(expectedAnswer)) {
    return { method: "not_applicable", stepChecks, disagreement: false };
  }
  const eq = equivalentAnswers(studentFinal, expectedAnswer);
  if (eq === null) return { method: "not_applicable", stepChecks, disagreement: false, note: "Student answer is not a pure number/expression." };
  const aiSaysCorrect = aiFinalStatus === "CORRECT";
  const disagreement = (eq && aiFinalStatus === "INCORRECT") || (!eq && aiSaysCorrect);
  return {
    method: "deterministic",
    finalAnswerCorrect: eq,
    stepChecks,
    disagreement,
    note: disagreement ? `Exact check says the final answer is ${eq ? "correct" : "incorrect"}, but the AI marked it ${aiFinalStatus.toLowerCase()}.` : undefined,
  };
}

/** Stage 3 + 4 — mathematical evaluation and step-wise marking. */
export async function gradeAnswers(ctx: EvalContext, extraction: ExtractionResult, rubrics: EstablishedRubric[]): Promise<GradingResult> {
  const blocks = ctx.questions.map((q, i) => {
    const ex = extraction.byNumber.get(q.number)!;
    const r = rubrics[i];
    return [
      `Q${q.number} (maximum ${q.maxMarks} marks): ${q.text}`,
      `Expected answer: ${q.expectedAnswer}`,
      r.expectedSolution ? `Expected solution: ${r.expectedSolution}` : "",
      r.alternativeMethods.length ? `Valid alternative methods: ${r.alternativeMethods.join("; ")}` : "",
      `Rubric (${r.source === "PARENT" ? "set by parent — follow strictly" : "generated"}):`,
      ...r.steps.map((s, k) => `  [${k}] ${s.description} — ${s.marks} marks`),
      ex.answerPresent
        ? `Student's transcribed steps:\n${ex.steps.map((s) => `  - ${s}`).join("\n") || "  (none)"}\nStudent's final answer: ${ex.finalAnswer}\nTranscription confidence: ${ex.confidence}${ex.unreadable.length ? `\nUnreadable parts: ${ex.unreadable.join("; ")}` : ""}`
        : "Student's work: NO ANSWER FOUND",
    ]
      .filter(Boolean)
      .join("\n");
  });
  const intro = `Class ${ctx.grade} ${ctx.subject} — ${ctx.topic}. Assignment: ${ctx.assignmentTitle}.${
    ctx.markingScheme ? `\nParent's marking scheme (takes priority): ${ctx.markingScheme}` : ""
  }\nAlternative valid methods allowed: ${ctx.allowAlternativeMethods ? "yes" : "no — follow the expected method"}.${
    ctx.learningContext.length ? `\nContext from earlier work: ${ctx.learningContext.join("; ")}` : ""
  }`;

  let extra = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, model } = await aiProvider().generateJson({
      purpose: "evaluation",
      model: models().evaluation,
      promptVersion: PROMPT_VERSIONS.evaluation,
      system: EVALUATION_SYSTEM,
      schema: evaluationSchema,
      temperature: 0,
      referenceId: ctx.submissionId,
      parts: [{ text: `${intro}\n\n${blocks.join("\n\n")}${extra}` }],
      mockContext: {
        questions: ctx.questions.map((q, i) => ({
          number: q.number,
          text: q.text,
          maxMarks: q.maxMarks,
          expectedAnswer: q.expectedAnswer,
          rubric: rubrics[i].steps,
          studentAnswer: extraction.byNumber.get(q.number)?.finalAnswer ?? null,
        })),
      },
    });
    const problems = validateGrading(data, ctx, rubrics);
    if (!problems.length) return assemble(data, ctx, extraction, rubrics, model);
    extra = `\n\nYour previous marking was rejected for these reasons — fix them:\n- ${problems.join("\n- ")}`;
    if (attempt === 1) throw new AIError("invalid_response", `Evaluation failed consistency checks: ${problems.slice(0, 3).join(" ")}`);
  }
  throw new AIError("invalid_response", "Evaluation failed consistency checks.");
}

function assemble(out: EvaluationOutput, ctx: EvalContext, extraction: ExtractionResult, rubrics: EstablishedRubric[], model: string): GradingResult {
  const questions = ctx.questions.map((q, i) => {
    const g = out.questions.find((x) => x.question_number === q.number)!;
    const ex = extraction.byNumber.get(q.number)!;
    const rubric = rubrics[i];
    const steps: GradedStep[] = rubric.steps.map((r, k) => {
      const s = g.step_results.find((x) => x.rubric_index === k)!;
      return { position: k, description: r.description, awarded: s.marks, max: r.marks, status: s.status, comment: s.comment };
    });
    const verification = verifyQuestion(q.expectedAnswer, ex.finalAnswer, ex.steps, g.final_answer_status);
    const reviewReasons: string[] = [];
    if (verification.disagreement) reviewReasons.push(`Q${q.number}: ${verification.note}`);
    if (ex.needsReview) reviewReasons.push(`Q${q.number}: handwriting was hard to read.`);
    if (g.needs_review) reviewReasons.push(`Q${q.number}: the AI was unsure about its marking.`);
    if (rubric.answerConflict) reviewReasons.push(`Q${q.number}: the AI's worked answer differs from the expected answer — please check the answer key.`);
    const result = (g.status === "unanswered" ? "UNANSWERED" : g.status.toUpperCase()) as GradedQuestion["result"];
    return {
      questionId: q.id,
      number: q.number,
      awarded: Math.round(g.awarded_marks * 100) / 100,
      max: q.maxMarks,
      result,
      conceptAccuracy: g.concept_understanding,
      calculationAccuracy: g.calculation_accuracy,
      finalAnswerStatus: g.final_answer_status,
      mistakeTypes: g.mistake_types,
      mistakeDescription: g.mistake_description,
      steps,
      confidence: Math.min(g.confidence, ex.confidence),
      needsReview: reviewReasons.length > 0,
      verification,
      reviewReasons,
    } satisfies GradedQuestion;
  });
  return { questions, summary: out.summary, strengths: out.strengths, needsAttention: out.needs_attention, model };
}
