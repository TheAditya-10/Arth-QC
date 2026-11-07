"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { useStore } from "@/lib/client/store";

export interface DashboardSummary {
  totalAssignments: number;
  completionRate: number;
  averageScore: number;
  currentStreak: number;
  longestStreak: number;
  weeklyStudyDays: number;
  weeklyStudyMinutes: number;
  topicAccuracy: { topic: string; accuracy: number; attempts: number; masteryLevel: string }[];
  weakTopics: { topic: string; mastery: number }[];
  repeatedMistakes: { kind: string; count: number }[];
  correctedMistakes: number;
  improvementPercent: number;
  recommendations: { topicName: string; reason: string; difficulty: string }[];
  recentSubmissions: { id: string; title: string; submittedAt: string; status: string; score: number | null; maxScore: number | null }[];
}

/** Parent dashboard aggregates from GET /api/progress/summary (recomputed when state changes). */
export function useDashboard() {
  const version = useStore((db) => db.version);
  const studentId = useStore((db) => db.viewer.activeStudentId);
  const [data, setData] = useState<DashboardSummary | null>(null);
  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    api<DashboardSummary>("GET", `/api/progress/summary?studentId=${studentId}`)
      .then((d) => !cancelled && setData(d))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [version, studentId]);
  return data;
}
