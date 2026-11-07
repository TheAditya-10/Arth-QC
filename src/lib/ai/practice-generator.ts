import "server-only";
import { aiProvider, models } from ".";
import { GENERATION_SYSTEM, PROMPT_VERSIONS } from "./prompts";
import { generatedQuestionsSchema, type GeneratedQuestions } from "./schemas";
import { rubricIsValid, fallbackRubric } from "./rubric.service";

export interface GenerationRequest {
  grade: number;
  topicCode: string;
  topicName: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  count: number;
  marksEach: number;
  questionTypes?: string[];
  /** Explainable focus, e.g. "repeated calculation errors when adding unlike fractions". */
  focus?: string[];
  referenceId?: string;
}

/** AI question generation for homework and practice; rubrics are validated and repaired. */
export async function generateQuestions(req: GenerationRequest): Promise<{ data: GeneratedQuestions; model: string }> {
  const { data, model } = await aiProvider().generateJson({
    purpose: "generation",
    model: models().evaluation,
    promptVersion: PROMPT_VERSIONS.generation,
    system: GENERATION_SYSTEM,
    schema: generatedQuestionsSchema,
    temperature: 0.7,
    referenceId: req.referenceId,
    parts: [
      {
        text: `Write ${req.count} ${req.difficulty.toLowerCase()} questions for Class ${req.grade} on "${req.topicName}". Each question is worth ${req.marksEach} marks.${
          req.questionTypes?.length ? `\nQuestion types to include: ${req.questionTypes.join(", ")}.` : ""
        }${req.focus?.length ? `\nFocus areas (the student struggles here): ${req.focus.join("; ")}.` : ""}`,
      },
    ],
    mockContext: { topicCode: req.topicCode, topicName: req.topicName, difficulty: req.difficulty, count: req.count, marksEach: req.marksEach },
  });
  return {
    model,
    data: {
      ...data,
      questions: data.questions.slice(0, req.count).map((q) => ({
        ...q,
        marks: req.marksEach,
        rubric: rubricIsValid(q.rubric, req.marksEach) ? q.rubric : fallbackRubric(req.marksEach),
      })),
    },
  };
}
