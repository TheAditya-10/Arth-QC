import type { WeeklyReport } from "@/types";

/** Persisted JSON payload of a weekly report (weekly_reports.data). */
export interface WeeklyReportData extends Omit<WeeklyReport, "id" | "weekStart" | "weekEnd"> {
  studentName: string;
  achievementsUnlocked: string[];
  weakConcepts: string[];
  /** Explainable recommendations: topic + reason. */
  recommendations: { topic: string; reason: string }[];
}
