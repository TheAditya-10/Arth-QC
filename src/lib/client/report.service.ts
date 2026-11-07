"use client";

import type { ReportSettings, WeeklyReport } from "@/types";
import type { AppState } from "@/types/app-state";
import { api } from "./api";
import { peekState, refresh } from "./store";

/** The current week's report is computed on the server from database records. */
export function buildCurrentWeekReport(db: AppState): WeeklyReport {
  return (
    db.currentReport ?? {
      id: "current",
      weekStart: new Date().toISOString(),
      weekEnd: new Date().toISOString(),
      averageScore: 0,
      previousAverageScore: 0,
      assignmentsCompleted: 0,
      assignmentsAssigned: 0,
      studyDays: 0,
      studyMinutes: 0,
      mistakesCorrected: 0,
      topicScores: [],
      dailyMinutes: [],
      highlights: [],
      focusNextWeek: [],
    }
  );
}

export async function updateReportSettings(patch: Partial<ReportSettings>): Promise<void> {
  await api("PATCH", "/api/reports/settings", {
    ...(patch.enabled !== undefined && { enabled: patch.enabled }),
    ...(patch.day && { day: patch.day }),
    ...(patch.time && { time: patch.time }),
    ...(patch.includeTopicBreakdown !== undefined && { includeTopicBreakdown: patch.includeTopicBreakdown }),
    ...(patch.includeMistakes !== undefined && { includeMistakes: patch.includeMistakes }),
    ...(patch.recipients && { recipients: patch.recipients.map((r) => ({ id: r.id, enabled: r.enabled })) }),
  });
  await refresh();
}

/** Sends a real test email (via Resend) to enabled recipients. */
export async function sendTestReport(): Promise<{ sentTo: string[]; results: { email: string; status: string }[] }> {
  const res = await api<{ results: { email: string; status: string }[] }>("POST", "/api/reports/test", { studentProfileId: peekState()?.viewer.activeStudentId });
  await refresh();
  return { sentTo: res.results.filter((r) => r.status !== "FAILED").map((r) => r.email), results: res.results };
}

export async function retryReport(reportId: string) {
  const res = await api<{ status: string; sent: number; failed: number }>("POST", `/api/reports/${reportId}/retry`);
  await refresh();
  return res;
}
