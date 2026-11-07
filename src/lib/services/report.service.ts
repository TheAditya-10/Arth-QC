import "server-only";
import { and, asc, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema, type DbOrTx } from "@/lib/db";
import { appUrl } from "@/lib/env";
import { notFound, AppError } from "@/lib/security/errors";
import { assertStudentAccess, type Actor } from "@/lib/security/actor";
import { sendEmail } from "@/lib/email/resend.client";
import { weeklyReportEmail } from "@/lib/email/templates/weekly-report";
import { addDaysStr, localClock, localDateIn, startOfLocalDay, weekStartOf } from "@/lib/utils/timezone";
import { pct } from "./gamification";
import { recommendationsFor } from "./progress";
import type { WeeklyReportData } from "./report.types";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const ERROR_LABELS: Record<string, string> = {
  conceptual: "Concept mix-ups",
  calculation: "Calculation slips",
  incomplete: "Incomplete working",
  notation: "Missing units / notation",
  method: "Choosing the method",
  misread: "Reading the question carefully",
};

async function weekAverage(tx: DbOrTx, studentProfileId: string, from: Date, to: Date) {
  const rows = await tx
    .select({ score: schema.evaluations.score, max: schema.evaluations.maxScore })
    .from(schema.evaluations)
    .innerJoin(schema.submissions, eq(schema.submissions.id, schema.evaluations.submissionId))
    .where(and(eq(schema.submissions.studentProfileId, studentProfileId), eq(schema.evaluations.isCurrent, true), isNull(schema.submissions.deletedAt), gte(schema.evaluations.createdAt, from), lt(schema.evaluations.createdAt, to)));
  return rows.length ? Math.round(rows.reduce((s, r) => s + pct(r.score, r.max), 0) / rows.length) : 0;
}

/** Builds a weekly report (Mon–Sun, family timezone) entirely from database records. */
export async function buildWeeklyReport(tx: DbOrTx, studentProfileId: string, weekStart: string, timezone: string): Promise<WeeklyReportData> {
  const from = startOfLocalDay(timezone, weekStart);
  const to = startOfLocalDay(timezone, addDaysStr(weekStart, 7));
  const prevFrom = startOfLocalDay(timezone, addDaysStr(weekStart, -7));
  const [profile] = await tx.select().from(schema.studentProfiles).where(eq(schema.studentProfiles.id, studentProfileId));

  const evals = await tx
    .select({ score: schema.evaluations.score, max: schema.evaluations.maxScore, topic: schema.topics.name, title: schema.assignments.title })
    .from(schema.evaluations)
    .innerJoin(schema.submissions, eq(schema.submissions.id, schema.evaluations.submissionId))
    .innerJoin(schema.assignments, eq(schema.assignments.id, schema.submissions.assignmentId))
    .innerJoin(schema.topics, eq(schema.topics.id, schema.assignments.topicId))
    .where(and(eq(schema.submissions.studentProfileId, studentProfileId), eq(schema.evaluations.isCurrent, true), isNull(schema.submissions.deletedAt), gte(schema.evaluations.createdAt, from), lt(schema.evaluations.createdAt, to)))
    .orderBy(asc(schema.evaluations.createdAt));
  const averageScore = evals.length ? Math.round(evals.reduce((s, e) => s + pct(e.score, e.max), 0) / evals.length) : 0;
  const previousAverageScore = await weekAverage(tx, studentProfileId, prevFrom, from);

  const [{ assigned }] = await tx
    .select({ assigned: sql<number>`count(*)::int` })
    .from(schema.assignments)
    .where(and(eq(schema.assignments.studentProfileId, studentProfileId), isNull(schema.assignments.deletedAt), gte(schema.assignments.dueAt, from), lt(schema.assignments.dueAt, to)));

  const activity = await tx
    .select({ day: schema.learningActivityLogs.localDate, minutes: sql<number>`sum(${schema.learningActivityLogs.minutes})::int` })
    .from(schema.learningActivityLogs)
    .where(and(eq(schema.learningActivityLogs.studentProfileId, studentProfileId), gte(schema.learningActivityLogs.localDate, weekStart), lt(schema.learningActivityLogs.localDate, addDaysStr(weekStart, 7))))
    .groupBy(schema.learningActivityLogs.localDate);
  const dailyMinutes = DAY_LABELS.map((day, i) => ({ day, minutes: activity.find((a) => a.day === addDaysStr(weekStart, i))?.minutes ?? 0 }));

  const [{ corrected }] = await tx
    .select({ corrected: sql<number>`count(*)::int` })
    .from(schema.mistakeNotebook)
    .where(and(eq(schema.mistakeNotebook.studentProfileId, studentProfileId), eq(schema.mistakeNotebook.status, "CORRECTED"), gte(schema.mistakeNotebook.correctedAt, from), lt(schema.mistakeNotebook.correctedAt, to)));

  const achievementsUnlocked = (
    await tx
      .select({ title: schema.achievements.title })
      .from(schema.studentAchievements)
      .innerJoin(schema.achievements, eq(schema.achievements.id, schema.studentAchievements.achievementId))
      .where(and(eq(schema.studentAchievements.studentProfileId, studentProfileId), gte(schema.studentAchievements.unlockedAt, from), lt(schema.studentAchievements.unlockedAt, to)))
  ).map((a) => a.title);

  const topicMap = new Map<string, number[]>();
  for (const e of evals) topicMap.set(e.topic, [...(topicMap.get(e.topic) ?? []), pct(e.score, e.max)]);
  const topicScores = [...topicMap].map(([topic, xs]) => ({ topic, score: Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) }));

  const progress = await tx
    .select({ name: schema.topics.name, errors: schema.topicProgress.repeatedErrors })
    .from(schema.topicProgress)
    .innerJoin(schema.topics, eq(schema.topics.id, schema.topicProgress.topicId))
    .where(eq(schema.topicProgress.studentProfileId, studentProfileId));
  const weakConcepts = progress
    .flatMap((p) => Object.entries(p.errors).filter(([, n]) => n >= 2).map(([k, n]) => ({ text: `${ERROR_LABELS[k] ?? k} in ${p.name}`, n })))
    .sort((a, b) => b.n - a.n)
    .slice(0, 4)
    .map((x) => x.text);
  const recs = (await recommendationsFor(tx, studentProfileId, profile.grade)).slice(0, 3);

  const studyDays = dailyMinutes.filter((d) => d.minutes > 0).length;
  const highlights = [
    ...(evals.length ? [`Completed ${evals.length} homework assignment${evals.length > 1 ? "s" : ""}`] : []),
    ...(evals.length ? [`Best score: ${Math.max(...evals.map((e) => Math.round(pct(e.score, e.max))))}% (${evals.reduce((b, e) => (pct(e.score, e.max) > pct(b.score, b.max) ? e : b)).title})`] : []),
    `Studied on ${studyDays} day${studyDays === 1 ? "" : "s"}`,
    ...achievementsUnlocked.map((a) => `Unlocked the ${a} badge`),
  ];
  return {
    studentName: profile.displayName,
    averageScore,
    previousAverageScore,
    assignmentsCompleted: evals.length,
    assignmentsAssigned: Math.max(assigned, evals.length),
    studyDays,
    studyMinutes: dailyMinutes.reduce((s, d) => s + d.minutes, 0),
    mistakesCorrected: corrected,
    topicScores,
    dailyMinutes,
    highlights,
    focusNextWeek: recs.map((r) => r.topicName),
    achievementsUnlocked,
    weakConcepts,
    recommendations: recs.map((r) => ({ topic: r.topicName, reason: r.reason })),
  };
}

/** Week a report covers: Sunday schedules report the current Mon–Sun week, other days the previous one. */
export function reportWeekFor(localToday: string, reportDay: number): string {
  const ws = weekStartOf(localToday);
  return reportDay === 0 ? ws : addDaysStr(ws, -7);
}

export async function generateReport(studentProfileId: string, familyId: string, weekStart: string, timezone: string) {
  const d = db();
  const data = await buildWeeklyReport(d, studentProfileId, weekStart, timezone);
  const [row] = await d
    .insert(schema.weeklyReports)
    .values({ studentProfileId, familyId, weekStart, weekEnd: addDaysStr(weekStart, 6), timezone, data })
    .onConflictDoNothing()
    .returning();
  if (row) return row;
  const [existing] = await d.select().from(schema.weeklyReports).where(and(eq(schema.weeklyReports.studentProfileId, studentProfileId), eq(schema.weeklyReports.weekStart, weekStart)));
  return existing;
}

/** Sends a report to all enabled recipients. Already-delivered recipients are skipped (no duplicates). */
export async function deliverReport(reportId: string) {
  const d = db();
  const [report] = await d.select().from(schema.weeklyReports).where(eq(schema.weeklyReports.id, reportId));
  if (!report) throw notFound("Report");
  const [fam] = await d.select().from(schema.families).where(eq(schema.families.id, report.familyId));
  const recipients = await d.select().from(schema.reportRecipients).where(and(eq(schema.reportRecipients.familyId, report.familyId), eq(schema.reportRecipients.enabled, true)));
  const mail = weeklyReportEmail({ data: report.data, weekStart: report.weekStart, weekEnd: report.weekEnd, link: `${appUrl()}/parent/reports`, includeTopics: fam.reportIncludeTopics, includeMistakes: fam.reportIncludeMistakes });
  let sent = 0;
  let failed = 0;
  for (const r of recipients) {
    await d.insert(schema.emailDeliveryLogs).values({ familyId: report.familyId, weeklyReportId: report.id, template: "weekly_report", recipientEmail: r.email, subject: mail.subject }).onConflictDoNothing();
    const [log] = await d.select().from(schema.emailDeliveryLogs).where(and(eq(schema.emailDeliveryLogs.weeklyReportId, report.id), eq(schema.emailDeliveryLogs.recipientEmail, r.email)));
    if (log.status === "SENT") {
      sent++;
      continue;
    }
    const res = await sendEmail({ to: r.email, subject: mail.subject, html: mail.html, text: mail.text, idempotencyKey: `report-${report.id}-${r.email}` });
    await d
      .update(schema.emailDeliveryLogs)
      .set({
        status: res.status,
        attempts: log.attempts + 1,
        providerMessageId: res.status === "SENT" ? res.providerMessageId : log.providerMessageId,
        error: res.status === "FAILED" ? res.error : res.status === "SKIPPED" ? res.reason : null,
        sentAt: res.status === "SENT" ? new Date() : null,
      })
      .where(eq(schema.emailDeliveryLogs.id, log.id));
    if (res.status === "SENT" || res.status === "SKIPPED") sent++;
    else failed++;
  }
  const status = failed === 0 ? "SENT" : sent === 0 ? "FAILED" : "PARTIAL";
  await d.update(schema.weeklyReports).set({ status, sentAt: status !== "FAILED" ? new Date() : null }).where(eq(schema.weeklyReports.id, report.id));
  return { status, sent, failed };
}

/** Cron entry: generate + send reports for every family whose scheduled time has passed. Idempotent. */
export async function runScheduledReports(now = new Date()) {
  const d = db();
  const families = await d.select().from(schema.families).where(eq(schema.families.reportEnabled, true));
  const out: { familyId: string; studentProfileId: string; status: string }[] = [];
  for (const f of families) {
    const today = localDateIn(f.timezone, now);
    const { weekday, hhmm } = localClock(f.timezone, now);
    // Days elapsed since this week's scheduled day (Mon-based week).
    const idx = (w: number) => (w + 6) % 7;
    const due = idx(weekday) > idx(f.reportDay) || (idx(weekday) === idx(f.reportDay) && hhmm >= f.reportTime);
    if (!due) continue;
    const scheduledDay = addDaysStr(weekStartOf(today), idx(f.reportDay));
    const weekStart = reportWeekFor(scheduledDay, f.reportDay);
    const students = await d.select({ id: schema.studentProfiles.id }).from(schema.studentProfiles).where(eq(schema.studentProfiles.familyId, f.id));
    for (const s of students) {
      const report = await generateReport(s.id, f.id, weekStart, f.timezone);
      if (report.status === "SENT") continue;
      const res = await deliverReport(report.id);
      out.push({ familyId: f.id, studentProfileId: s.id, status: res.status });
    }
  }
  return out;
}

/** Retry failed deliveries (cron + manual). */
export async function retryFailedDeliveries(limit = 20) {
  const d = db();
  const rows = await d
    .select({ id: schema.weeklyReports.id })
    .from(schema.weeklyReports)
    .where(inArray(schema.weeklyReports.status, ["FAILED", "PARTIAL"]))
    .orderBy(desc(schema.weeklyReports.generatedAt))
    .limit(limit);
  const results = [];
  for (const r of rows) results.push({ id: r.id, ...(await deliverReport(r.id)) });
  return results;
}

// ---------- Parent-facing API ----------

export async function currentReportPreview(actor: Actor, studentProfileId: string) {
  await assertStudentAccess(actor, studentProfileId);
  const today = localDateIn(actor.timezone);
  const weekStart = weekStartOf(today);
  return { weekStart, weekEnd: addDaysStr(weekStart, 6), data: await buildWeeklyReport(db(), studentProfileId, weekStart, actor.timezone) };
}

export async function reportHistory(actor: Actor, studentProfileId: string) {
  await assertStudentAccess(actor, studentProfileId);
  const d = db();
  const reports = await d
    .select()
    .from(schema.weeklyReports)
    .where(eq(schema.weeklyReports.studentProfileId, studentProfileId))
    .orderBy(desc(schema.weeklyReports.weekStart))
    .limit(12);
  const logs = reports.length
    ? await d.select().from(schema.emailDeliveryLogs).where(inArray(schema.emailDeliveryLogs.weeklyReportId, reports.map((r) => r.id)))
    : [];
  return reports.map((r) => ({
    ...r,
    deliveries: logs.filter((l) => l.weeklyReportId === r.id).map((l) => ({ email: l.recipientEmail, status: l.status, error: l.error, sentAt: l.sentAt, attempts: l.attempts })),
  }));
}

export async function sendTestReport(actor: Actor, studentProfileId: string) {
  const preview = await currentReportPreview(actor, studentProfileId);
  const d = db();
  const [fam] = await d.select().from(schema.families).where(eq(schema.families.id, actor.familyId));
  const recipients = await d.select().from(schema.reportRecipients).where(and(eq(schema.reportRecipients.familyId, actor.familyId), eq(schema.reportRecipients.enabled, true)));
  if (!recipients.length) throw new AppError("VALIDATION", "Enable at least one recipient first.");
  const mail = weeklyReportEmail({ data: preview.data, weekStart: preview.weekStart, weekEnd: preview.weekEnd, link: `${appUrl()}/parent/reports`, includeTopics: fam.reportIncludeTopics, includeMistakes: fam.reportIncludeMistakes, isTest: true });
  const results = [];
  for (const r of recipients) {
    const res = await sendEmail({ to: r.email, subject: mail.subject, html: mail.html, text: mail.text });
    await d.insert(schema.emailDeliveryLogs).values({
      familyId: actor.familyId,
      template: "weekly_report_test",
      recipientEmail: r.email,
      subject: mail.subject,
      status: res.status,
      attempts: 1,
      providerMessageId: res.status === "SENT" ? res.providerMessageId : null,
      error: res.status === "FAILED" ? res.error : res.status === "SKIPPED" ? res.reason : null,
      sentAt: res.status === "SENT" ? new Date() : null,
    });
    results.push({ email: r.email, status: res.status });
  }
  return { results };
}

export async function retryReport(actor: Actor, reportId: string) {
  const [r] = await db().select().from(schema.weeklyReports).where(eq(schema.weeklyReports.id, reportId));
  if (!r || r.familyId !== actor.familyId) throw notFound("Report");
  await assertStudentAccess(actor, r.studentProfileId);
  return deliverReport(r.id);
}

export const reportSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  day: z.enum(["Sunday", "Monday", "Friday", "Saturday"]).optional(),
  time: z.string().regex(/^[0-2]\d:[0-5]\d$/).optional(),
  includeTopicBreakdown: z.boolean().optional(),
  includeMistakes: z.boolean().optional(),
  recipients: z.array(z.object({ id: z.string().uuid(), enabled: z.boolean() })).optional(),
});
const DAY_NUM: Record<string, number> = { Sunday: 0, Monday: 1, Friday: 5, Saturday: 6 };

export async function updateReportSettings(actor: Actor, input: z.infer<typeof reportSettingsSchema>) {
  const d = db();
  await d
    .update(schema.families)
    .set({
      ...(input.enabled !== undefined && { reportEnabled: input.enabled }),
      ...(input.day && { reportDay: DAY_NUM[input.day] }),
      ...(input.time && { reportTime: input.time }),
      ...(input.includeTopicBreakdown !== undefined && { reportIncludeTopics: input.includeTopicBreakdown }),
      ...(input.includeMistakes !== undefined && { reportIncludeMistakes: input.includeMistakes }),
      updatedAt: new Date(),
    })
    .where(eq(schema.families.id, actor.familyId));
  for (const r of input.recipients ?? []) {
    await d.update(schema.reportRecipients).set({ enabled: r.enabled }).where(and(eq(schema.reportRecipients.id, r.id), eq(schema.reportRecipients.familyId, actor.familyId)));
  }
}
