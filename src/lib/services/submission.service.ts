"use client";

import type { Assignment, ErrorKind, Evaluation, QuestionResult, ResultStatus, Submission, UploadedFile } from "@/types";
import { pct, sleep, uid } from "@/lib/utils";
import { xpForEvaluation } from "@/lib/utils/gamification";
import { topicName } from "@/lib/mock-data/curriculum";
import { PRACTICE_BANK } from "@/lib/mock-data/practice-bank";
import { getDB, setDB } from "./store";
import { applyProgress, awardXP, markStudied, updateTopic } from "./progress-engine";

export const EVALUATION_STAGES = [
  { key: "reading", label: "Reading handwriting", detail: "Scanning your notebook pages…" },
  { key: "identifying", label: "Identifying questions", detail: "Matching answers to each question…" },
  { key: "checking", label: "Checking mathematical steps", detail: "Looking at every step of your working…" },
  { key: "feedback", label: "Preparing feedback", detail: "Writing friendly tips just for you…" },
] as const;

/** deterministic pseudo-random from a string seed */
function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const ERROR_LIBRARY: Record<Exclude<ResultStatus, "correct">, { kind: ErrorKind; description: string; explanation: string }[]> = {
  partial: [
    { kind: "calculation", description: "A small calculation slip in the last step.", explanation: "Your method is right! Re-check the final calculation slowly, one digit at a time." },
    { kind: "incomplete", description: "The working stops before the final answer.", explanation: "You were on the right track. Finish the last step and write the final answer clearly." },
    { kind: "notation", description: "The answer is missing units or proper notation.", explanation: "The number is correct — remember to write units or symbols so it is complete." },
  ],
  incorrect: [
    { kind: "conceptual", description: "The idea used does not match what the question asks.", explanation: "Read the question again and underline the key words. Which concept is it asking about? Try the hint in practice mode." },
    { kind: "calculation", description: "Several calculation errors changed the answer.", explanation: "Write each step on a new line so it is easy to spot mistakes. Check each operation again." },
  ],
};

function mockEvaluate(assignment: Assignment, submissionId: string): Evaluation {
  const rand = rng(submissionId + assignment.id);
  const results: QuestionResult[] = assignment.questions.map((q) => {
    const r = rand();
    const status: ResultStatus = r < 0.6 ? "correct" : r < 0.88 ? "partial" : "incorrect";
    if (status === "correct") {
      return {
        questionId: q.id,
        number: q.number,
        question: q.text,
        expectedAnswer: q.expectedAnswer,
        studentAnswer: q.expectedAnswer,
        maxMarks: q.marks,
        marksAwarded: q.marks,
        status,
        steps: [
          { description: "Correct method", awarded: Math.ceil(q.marks / 2), max: Math.ceil(q.marks / 2), ok: true },
          { description: "Correct final answer", awarded: Math.floor(q.marks / 2), max: Math.floor(q.marks / 2), ok: true },
        ],
        errors: [],
        explanation: "Well done! Your working is clear and the answer is correct.",
      };
    }
    const lib = ERROR_LIBRARY[status];
    const err = lib[Math.floor(rand() * lib.length)];
    const methodMax = Math.ceil(q.marks / 2);
    const answerMax = Math.floor(q.marks / 2);
    const methodAwarded = status === "partial" ? methodMax : Math.min(1, methodMax);
    const answerAwarded = status === "partial" && err.kind === "notation" ? Math.max(0, answerMax - 1) : 0;
    return {
      questionId: q.id,
      number: q.number,
      question: q.text,
      expectedAnswer: q.expectedAnswer,
      studentAnswer: status === "partial" ? `${q.expectedAnswer.split(/[;=]/)[0]} … (incomplete)` : "Answer could not be matched",
      maxMarks: q.marks,
      marksAwarded: methodAwarded + answerAwarded,
      status,
      steps: [
        { description: "Method / approach", awarded: methodAwarded, max: methodMax, ok: methodAwarded === methodMax },
        { description: "Final answer", awarded: answerAwarded, max: answerMax, ok: answerAwarded === answerMax },
      ],
      errors: [{ kind: err.kind, description: err.description }],
      explanation: err.explanation,
    };
  });
  const score = results.reduce((s, r) => s + r.marksAwarded, 0);
  const p = pct(score, assignment.maxMarks);
  const topic = topicName(assignment.topicId);
  const weak = results.filter((r) => r.status !== "correct");
  return {
    id: uid("e"),
    submissionId,
    assignmentId: assignment.id,
    score,
    maxScore: assignment.maxMarks,
    xpEarned: xpForEvaluation(p),
    evaluatedAt: new Date().toISOString(),
    results,
    summary:
      weak.length === 0
        ? `Every answer is correct — you have a strong grip on ${topic}!`
        : `Nice work on ${topic}. ${weak.length} question${weak.length > 1 ? "s need" : " needs"} another look — check the tips below.`,
    strengths: [`${topic}: core method`, ...(p >= 70 ? ["Neat, step-by-step working"] : [])],
    needsAttention: weak.length ? weak.map((w) => `Question ${w.number}: ${w.errors[0]?.description ?? "Review"}`) : [],
    suggestedPractice: PRACTICE_BANK.filter((x) => x.topicId === assignment.topicId)
      .slice(0, 3)
      .map((x) => x.text),
  };
}

export interface SubmitHomeworkInput {
  assignmentId: string;
  files: UploadedFile[];
  notes?: string;
  topicId?: string;
}

/** Step 1: upload. Calls onProgress with 0..100. */
export async function uploadFiles(files: UploadedFile[], onProgress: (p: number) => void): Promise<void> {
  const steps = 12 + files.length * 2;
  for (let i = 1; i <= steps; i++) {
    await sleep(90);
    onProgress(Math.round((i / steps) * 100));
  }
}

/** Step 2: create the submission record (status = processing). */
export async function createSubmission(input: SubmitHomeworkInput): Promise<Submission> {
  await sleep(300);
  const submission: Submission = {
    id: uid("s"),
    assignmentId: input.assignmentId,
    studentId: getDB().student.id,
    submittedAt: new Date().toISOString(),
    files: input.files,
    notes: input.notes,
    status: "processing",
  };
  setDB((db) => ({
    ...db,
    submissions: [submission, ...db.submissions],
    assignments: db.assignments.map((a) =>
      a.id === input.assignmentId
        ? { ...a, status: "submitted", progress: 100, topicId: input.topicId || a.topicId }
        : a,
    ),
  }));
  return submission;
}

/**
 * Step 3: simulated AI evaluation, reporting each stage.
 * Phase 2: replace with a server action that calls Gemini and streams progress.
 */
export async function evaluateSubmission(
  submissionId: string,
  onStage: (index: number) => void,
): Promise<Evaluation> {
  for (let i = 0; i < EVALUATION_STAGES.length; i++) {
    onStage(i);
    await sleep(1300 + i * 250);
  }
  const db = getDB();
  const submission = db.submissions.find((s) => s.id === submissionId);
  const assignment = submission && db.assignments.find((a) => a.id === submission.assignmentId);
  if (!submission || !assignment) throw new Error("Submission not found");
  const evaluation = mockEvaluate(assignment, submissionId);
  setDB((d) => {
    let next: typeof d = {
      ...d,
      evaluations: [evaluation, ...d.evaluations],
      submissions: d.submissions.map((s) =>
        s.id === submissionId ? { ...s, status: "evaluated", evaluationId: evaluation.id } : s,
      ),
      assignments: d.assignments.map((a) => (a.id === assignment.id ? { ...a, status: "evaluated" } : a)),
    };
    next = markStudied(next, assignment.estimatedMinutes);
    next = awardXP(next, evaluation.xpEarned, `${assignment.title} evaluated`, "assignment");
    next = updateTopic(next, assignment.topicId, pct(evaluation.score, evaluation.maxScore), 0.4);
    return applyProgress(next);
  });
  onStage(EVALUATION_STAGES.length);
  return evaluation;
}

/** Parent manual correction of marks for individual questions. */
export async function overrideEvaluation(
  evaluationId: string,
  marks: Record<string, number>,
  note: string,
): Promise<Evaluation> {
  await sleep(600);
  let updated: Evaluation | undefined;
  setDB((db) => {
    const evaluations = db.evaluations.map((e) => {
      if (e.id !== evaluationId) return e;
      const results = e.results.map((r) => {
        const m = marks[r.questionId];
        if (m === undefined || m === r.marksAwarded) return r;
        const status: ResultStatus = m >= r.maxMarks ? "correct" : m <= 0 ? "incorrect" : "partial";
        return { ...r, marksAwarded: m, status };
      });
      const score = results.reduce((s, r) => s + r.marksAwarded, 0);
      updated = { ...e, results, score, parentOverride: { score, note, at: new Date().toISOString(), originalScore: e.parentOverride?.originalScore ?? e.score } };
      return updated;
    });
    const submissions = db.submissions.map((s) =>
      s.evaluationId === evaluationId ? { ...s, status: "reviewed" as const } : s,
    );
    return applyProgress({ ...db, evaluations, submissions });
  });
  if (!updated) throw new Error("Evaluation not found");
  return updated;
}

/** Downscale an image file into a compact JPEG data URL so it fits in localStorage. */
export async function fileToPreview(file: File, maxSize = 900): Promise<string> {
  if (!file.type.startsWith("image/")) return "";
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.72);
  } catch {
    return "";
  } finally {
    URL.revokeObjectURL(url);
  }
}
