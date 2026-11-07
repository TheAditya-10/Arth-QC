"use client";

import type { UploadedFile } from "@/types";
import { api, idempotencyKey } from "./api";
import { refresh } from "./store";
import { uploadFile } from "./upload";

export const EVALUATION_STAGES = [
  { key: "reading", label: "Reading handwriting", detail: "Scanning your notebook pages…" },
  { key: "identifying", label: "Identifying questions", detail: "Matching answers to each question…" },
  { key: "checking", label: "Checking mathematical steps", detail: "Looking at every step of your working…" },
  { key: "feedback", label: "Preparing feedback", detail: "Writing friendly tips just for you…" },
] as const;

/** A file chosen in the browser, before upload. */
export type LocalFile = UploadedFile & { file?: File };

/** Uploads all files (sequentially, for clear progress). Returns upload ids in page order. */
export async function uploadFiles(files: LocalFile[], onProgress: (p: number) => void): Promise<string[]> {
  const ids: string[] = [];
  const total = files.reduce((s, f) => s + f.size, 0) || 1;
  let done = 0;
  for (const f of files) {
    if (!f.file) throw new Error(`"${f.name}" needs to be added again.`);
    const id = await uploadFile(f.file, "SUBMISSION", (frac) => onProgress(Math.round(((done + frac * f.size) / total) * 100)));
    done += f.size;
    ids.push(id);
  }
  onProgress(100);
  return ids;
}

/** Finalise the submission. The idempotency key makes retries safe. */
export async function createSubmission(input: { assignmentId: string; uploadIds: string[]; notes?: string; key?: string }) {
  return api<{ submissionId: string; jobId: string | null; duplicate: boolean }>("POST", "/api/submissions", {
    assignmentId: input.assignmentId,
    uploadIds: input.uploadIds,
    notes: input.notes,
    idempotencyKey: input.key ?? idempotencyKey(),
  });
}

export interface SubmissionStatus {
  status: string;
  stage: number;
  done: boolean;
  retrying: boolean;
  attempts: number;
  error: string | null;
}

/**
 * Polls evaluation status until done. Calls onStage with 0-3 while the backend
 * extracts/evaluates; never blocks the server request on Gemini.
 */
export async function evaluateSubmission(
  submissionId: string,
  onStage: (index: number) => void,
  opts: { timeoutMs?: number; onStatus?: (s: SubmissionStatus) => void } = {},
): Promise<SubmissionStatus> {
  const started = Date.now();
  let shown = 0;
  let delay = 1500;
  for (;;) {
    const s = await api<SubmissionStatus>("GET", `/api/submissions/${submissionId}/status`);
    opts.onStatus?.(s);
    // Advance the visible stage smoothly (never backwards).
    const target = s.done ? 4 : Math.max(s.stage, shown);
    if (target > shown) {
      for (let i = shown + 1; i <= target; i++) {
        onStage(i);
        await new Promise((r) => setTimeout(r, 500));
      }
      shown = target;
    } else if (!s.done && s.stage >= 2 && shown < 3 && Date.now() - started > 8000) {
      onStage(3);
      shown = 3;
    }
    if (s.done) {
      await refresh();
      return s;
    }
    if (Date.now() - started > (opts.timeoutMs ?? 240_000)) {
      await refresh();
      return s;
    }
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(5000, delay + 500);
  }
}

/** Parent correction of marks; the reason is stored with every change. */
export async function correctEvaluation(submissionId: string, corrections: { questionEvaluationId: string; newMarks: number }[], reason: string) {
  const res = await api<{ score: number; maxScore: number }>("POST", `/api/submissions/${submissionId}/corrections`, { corrections, reason });
  await refresh();
  return res;
}

export async function retryEvaluation(submissionId: string, newVersion = false) {
  await api("POST", `/api/submissions/${submissionId}/retry`, { newVersion });
  await refresh();
}

export async function deleteSubmission(submissionId: string) {
  await api("DELETE", `/api/submissions/${submissionId}`);
  await refresh();
}

/** Local preview only (object URL) — the file itself is uploaded on submit. */
export async function fileToPreview(file: File): Promise<string> {
  return file.type.startsWith("image/") ? URL.createObjectURL(file) : "";
}
