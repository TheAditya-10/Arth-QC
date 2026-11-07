import type { AIFile } from "./provider";

export interface RubricStepInput {
  description: string;
  marks: number;
}

export interface EvalQuestion {
  id: string;
  number: number;
  text: string;
  maxMarks: number;
  expectedAnswer: string;
  expectedSolution: string | null;
  rubric: { steps: RubricStepInput[]; source: "PARENT" | "AI_GENERATED"; alternativeMethods: string[] } | null;
}

export interface EvalContext {
  submissionId: string;
  grade: number;
  subject: string;
  topic: string;
  assignmentTitle: string;
  markingScheme?: string;
  allowAlternativeMethods: boolean;
  questions: EvalQuestion[];
  files: AIFile[];
  /** Short notes from previous work (weak topics, repeated error types). */
  learningContext: string[];
}

export const MARK_EPSILON = 0.01;
export const sumMarks = (xs: { marks: number }[]) => Math.round(xs.reduce((s, x) => s + x.marks, 0) * 100) / 100;
