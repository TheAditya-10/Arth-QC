"use client";

import type { Difficulty, PracticeSessionConfig } from "@/types";
import { api } from "./api";
import { refresh } from "./store";

export interface PracticeItem {
  id: string;
  topicId: string;
  difficulty: Difficulty;
  text: string;
  hint: string;
}

export interface PracticeSession {
  id: string;
  title: string;
  config: PracticeSessionConfig;
  items: PracticeItem[];
  retryOf?: string;
}

export interface AnswerResult {
  correct: boolean;
  answer: string;
  explanation: string;
}

export interface SessionResult {
  id: string;
  correct: number;
  total: number;
  xpEarned: number;
  completedAt: string;
  review: { questionId: string; text: string; answer: string; studentAnswer: string; correct: boolean }[];
}

export const SPECIAL_MODES = {
  daily: { title: "Daily Challenge", description: "5 mixed questions, fresh every day", count: 5, xp: "+15 XP" },
  weak: { title: "Weak-Topic Booster", description: "Target the topics that need love", count: 6, xp: "+10 XP" },
  revision: { title: "Quick Revision", description: "Easy recap of topics you've covered", count: 5, xp: "+10 XP" },
  weekly: { title: "Weekly Challenge", description: "10 tough questions. Are you ready?", count: 10, xp: "+50 XP" },
} as const;

export async function buildSession(config: PracticeSessionConfig): Promise<PracticeSession> {
  return api<PracticeSession>("POST", "/api/practice/sessions", {
    mode: config.mode,
    topicId: config.topicId,
    difficulty: config.difficulty,
    count: config.count,
  });
}

/** Retry the incorrect questions of an evaluation (or all open mistakes). */
export async function buildRetrySession(evaluationId?: string): Promise<PracticeSession> {
  return api<PracticeSession>("POST", "/api/practice/sessions", { mode: "retry", evaluationId });
}

/** Answers are checked on the server — the correct answer is only revealed afterwards. */
export async function answerQuestion(sessionId: string, questionId: string, answer: string, timeSpentSeconds: number): Promise<AnswerResult> {
  return api<AnswerResult>("POST", `/api/practice/sessions/${sessionId}/answers/${questionId}`, { answer, timeSpentSeconds });
}

export async function completeSession(session: PracticeSession): Promise<SessionResult> {
  const res = await api<SessionResult>("POST", `/api/practice/sessions/${session.id}/complete`);
  await refresh();
  return res;
}

export function abandonSession(sessionId: string) {
  void api("DELETE", `/api/practice/sessions/${sessionId}`).catch(() => {});
}
