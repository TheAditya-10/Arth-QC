"use client";

import type { Assignment, AssignmentStatus, Difficulty } from "@/types";
import type { AssignmentFormValues } from "@/lib/validations/assignment";
import { api } from "./api";
import { peekState, refresh } from "./store";

/** Derives the live status (e.g. overdue) for an assignment. */
export function liveStatus(a: Assignment, now = new Date()): AssignmentStatus {
  if (a.status === "submitted" || a.status === "evaluated") return a.status;
  if (new Date(a.dueDate).getTime() < now.getTime()) return "overdue";
  return a.status === "overdue" ? "pending" : a.status;
}

function toBody(values: AssignmentFormValues) {
  return {
    studentProfileId: peekState()?.viewer.activeStudentId,
    title: values.title,
    subjectId: values.subjectId,
    topicId: values.topicId,
    grade: values.grade,
    description: values.description,
    instructions: values.instructions
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean),
    questions: values.questions.map((q) => ({
      text: q.text,
      marks: q.marks,
      expectedAnswer: q.expectedAnswer,
      expectedSolution: q.expectedSolution ?? "",
      rubric: q.rubric ?? [],
    })),
    difficulty: values.difficulty,
    estimatedMinutes: values.estimatedMinutes,
    dueDate: new Date(values.dueDate).toISOString(),
    markingScheme: values.markingScheme ?? "",
    allowAlternativeMethods: values.allowAlternativeMethods ?? true,
    source: values.source,
    attachmentUploadIds: values.attachmentUploadIds ?? [],
  };
}

export async function createAssignment(values: AssignmentFormValues): Promise<{ id: string }> {
  const res = await api<{ id: string }>("POST", "/api/assignments", toBody(values));
  await refresh();
  return res;
}

export async function updateAssignment(id: string, values: AssignmentFormValues): Promise<{ id: string }> {
  const res = await api<{ id: string }>("PUT", `/api/assignments/${id}`, toBody(values));
  await refresh();
  return res;
}

export async function deleteAssignment(id: string): Promise<void> {
  await api("DELETE", `/api/assignments/${id}`);
  await refresh();
}

export function markAssignmentStarted(id: string) {
  void api("POST", `/api/assignments/${id}/start`).catch(() => {});
}

/** Gemini homework generation (draft for parent review — not saved until submitted). */
export async function generateAIQuestions(input: { topicId: string; difficulty: Difficulty; count: number; marksEach: number }) {
  return api<{
    title: string;
    description: string;
    questions: { text: string; marks: number; expectedAnswer: string; expectedSolution: string; rubric: { description: string; marks: number }[] }[];
  }>("POST", "/api/assignments/generate", { ...input, grade: peekState()?.student.grade ?? 6 });
}
