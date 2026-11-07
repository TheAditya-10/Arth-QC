"use client";

import type { ReportSettings, WeeklyReport } from "@/types";
import { addDays, dayKey, pct, sleep, startOfWeek, WEEKDAYS_SHORT } from "@/lib/utils";
import { topicName } from "@/lib/mock-data/curriculum";
import type { DemoDB } from "./store";
import { setDB } from "./store";

/** Builds the live report for the current week from the demo DB. */
export function buildCurrentWeekReport(db: DemoDB): WeeklyReport {
  const start = startOfWeek();
  const end = addDays(start, 6);
  const inWeek = (iso: string) => {
    const t = new Date(iso).getTime();
    return t >= start.getTime() && t < addDays(start, 7).getTime();
  };
  const evals = db.evaluations.filter((e) => inWeek(e.evaluatedAt));
  const pcts = evals.map((e) => pct(e.parentOverride?.score ?? e.score, e.maxScore));
  const avg = pcts.length ? Math.round(pcts.reduce((s, x) => s + x, 0) / pcts.length) : 0;
  const prev = db.pastReports[0]?.averageScore ?? 0;
  const dailyMinutes = WEEKDAYS_SHORT.map((day, i) => ({ day, minutes: db.studyMinutes[dayKey(addDays(start, i))] ?? 0 }));
  const studyDays = dailyMinutes.filter((d) => d.minutes > 0).length;
  const assigned = db.assignments.filter((a) => inWeek(a.dueDate)).length;
  const corrections = db.xpEvents.filter((x) => x.kind === "correction" && inWeek(x.at)).length;
  const weak = [...db.topicProgress].filter((t) => t.attempts > 0).sort((a, b) => a.mastery - b.mastery).slice(0, 2);
  const topicScores = evals.map((e) => {
    const a = db.assignments.find((x) => x.id === e.assignmentId);
    return { topic: a ? topicName(a.topicId) : "Homework", score: pct(e.parentOverride?.score ?? e.score, e.maxScore) };
  });
  return {
    id: "current",
    weekStart: start.toISOString(),
    weekEnd: end.toISOString(),
    averageScore: avg,
    previousAverageScore: prev,
    assignmentsCompleted: evals.length,
    assignmentsAssigned: Math.max(assigned, evals.length),
    studyDays,
    studyMinutes: dailyMinutes.reduce((s, d) => s + d.minutes, 0),
    mistakesCorrected: corrections,
    topicScores,
    dailyMinutes,
    highlights: [
      ...(evals.length ? [`Completed ${evals.length} homework assignment${evals.length > 1 ? "s" : ""}`] : []),
      `Current streak: ${db.student.streak} days`,
      ...db.achievements.filter((a) => a.unlockedAt && inWeek(a.unlockedAt)).map((a) => `Unlocked the ${a.title} badge`),
    ],
    focusNextWeek: weak.map((t) => t.topicName),
  };
}

export async function updateReportSettings(patch: Partial<ReportSettings>): Promise<void> {
  await sleep(300);
  setDB((db) => ({ ...db, reportSettings: { ...db.reportSettings, ...patch } }));
}

/** Simulated email send. No email leaves the browser in Phase 1. */
export async function sendTestReport(recipients: string[]): Promise<{ sentTo: string[] }> {
  await sleep(1400);
  if (!recipients.length) throw new Error("Add at least one enabled recipient");
  setDB((db) => ({ ...db, reportSettings: { ...db.reportSettings, lastSentAt: new Date().toISOString() } }));
  return { sentTo: recipients };
}
