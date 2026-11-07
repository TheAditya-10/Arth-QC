"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarClock, CheckCircle2, ClipboardList, Clock, Flame, GraduationCap, Percent, Plus, Repeat, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/states";
import { EvaluationStatusBadge } from "@/components/shared/status-badge";
import { KpiCard } from "@/components/parent/kpi-card";
import { ScoreTrendChart } from "@/components/charts/score-trend-chart";
import { TopicRadar } from "@/components/charts/topic-radar";
import { useAssignments, useWholeDB } from "@/hooks/use-data";
import { reportService } from "@/lib/services";
import { topicName } from "@/lib/mock-data/curriculum";
import { cn, daysUntil, dueLabel, formatDate, pct } from "@/lib/utils";

const SHORT: Record<string, string> = {
  "knowing-numbers": "Our Numbers",
  "whole-numbers": "Whole Nos.",
  "playing-numbers": "Factors",
  "basic-geometry": "Geometry",
  "elementary-shapes": "Shapes",
  integers: "Integers",
  fractions: "Fractions",
  decimals: "Decimals",
};

export default function ParentOverview() {
  const db = useWholeDB();
  const assignments = useAssignments();

  const d = useMemo(() => {
    if (!db || !assignments) return null;
    const evals = [...db.evaluations].sort((a, b) => a.evaluatedAt.localeCompare(b.evaluatedAt));
    const scores = evals.map((e) => pct(e.parentOverride?.score ?? e.score, e.maxScore));
    const avg = scores.length ? Math.round(scores.reduce((s, x) => s + x, 0) / scores.length) : 0;
    const dueSoFar = assignments.filter((a) => new Date(a.dueDate) <= new Date() || a.live === "evaluated" || a.live === "submitted");
    const completed = assignments.filter((a) => a.live === "evaluated" || a.live === "submitted").length;
    const completion = dueSoFar.length ? Math.round((completed / dueSoFar.length) * 100) : 100;
    const week = reportService.buildCurrentWeekReport(db);
    const errorCounts: Record<string, number> = {};
    evals.forEach((e) => e.results.forEach((r) => r.errors.forEach((er) => (errorCounts[er.kind] = (errorCounts[er.kind] ?? 0) + 1))));
    const repeated = Object.entries(errorCounts).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]);
    const pending = assignments.filter((a) => ["pending", "in_progress", "overdue"].includes(a.live)).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const weak = [...db.topicProgress].filter((t) => t.attempts > 0 && t.mastery < 65).sort((a, b) => a.mastery - b.mastery);
    return {
      evals,
      avg,
      completion,
      completed,
      week,
      repeated,
      pending,
      weak,
      trend: evals.map((e, i) => ({ label: formatDate(e.evaluatedAt), score: scores[i] })),
      radar: db.topicProgress.map((t) => ({ topic: SHORT[t.topicId] ?? t.topicName, score: t.mastery })),
    };
  }, [db, assignments]);

  if (!db || !d) return <PageSkeleton />;
  const s = db.student;
  const delta = d.week.averageScore && d.week.previousAverageScore ? d.week.averageScore - d.week.previousAverageScore : null;
  const ERROR_NAMES: Record<string, string> = { conceptual: "Concept mix-ups", calculation: "Calculation slips", incomplete: "Incomplete working", notation: "Missing units / notation" };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Overview"
        title={`${s.name}'s learning at a glance`}
        description="Everything you need to support learning from wherever you are."
        actions={
          <Button asChild>
            <Link href="/parent/assignments/new"><Plus /> New assignment</Link>
          </Button>
        }
      />

      {/* Profile + KPIs */}
      <div className="grid gap-4 xl:grid-cols-[300px_1fr]">
        <Card className="p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sun font-heading text-xl font-bold">{s.name[0]}</div>
            <div>
              <p className="font-heading text-lg font-bold">{s.name}</p>
              <p className="text-sm text-muted-foreground">Class {s.grade} · {s.curriculum}</p>
            </div>
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">School</dt><dd className="max-w-[60%] truncate text-right font-medium">{s.school}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Subject</dt><dd className="font-medium">Mathematics</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Level</dt><dd className="font-medium">Level {s.level} · {s.xp.toLocaleString("en-IN")} XP</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Daily goal</dt><dd className="font-medium">{s.dailyGoalMinutes} min</dd></div>
          </dl>
        </Card>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <KpiCard icon={ClipboardList} label="Total assignments" value={assignments!.length} sub={`${d.pending.length} open`} />
          <KpiCard icon={CheckCircle2} label="Completion rate" value={`${d.completion}%`} sub={`${d.completed} submitted on time or late`} />
          <KpiCard icon={Percent} label="Average marks" value={`${d.avg}%`} sub={`across ${d.evals.length} evaluations`} />
          <KpiCard icon={Flame} label="Current streak" value={`${s.streak} days`} sub={`Best ${s.longestStreak} days`} />
          <KpiCard icon={Clock} label="Study time this week" value={`${d.week.studyMinutes} min`} sub={`${d.week.studyDays} study days`} />
          <KpiCard icon={GraduationCap} label="Topics mastered" value={`${db.topicProgress.filter((t) => t.mastery >= 80).length}/8`} sub="80%+ mastery" />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Academic progress</CardTitle>
            <p className="text-sm text-muted-foreground">Homework score (%) over time</p>
          </CardHeader>
          <CardContent><ScoreTrendChart data={d.trend} height={260} /></CardContent>
        </Card>

        {/* Weekly summary */}
        <Card className="bg-indigo text-white">
          <CardHeader>
            <CardTitle>This week</CardTitle>
            <p className="text-sm text-indigo-200">{formatDate(d.week.weekStart)} – {formatDate(d.week.weekEnd)}</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white/10 p-3">
                <p className="text-xs text-indigo-200">Average score</p>
                <p className="font-heading text-2xl font-bold">{d.week.averageScore ? `${d.week.averageScore}%` : "—"}</p>
              </div>
              <div className="rounded-xl bg-white/10 p-3">
                <p className="text-xs text-indigo-200">vs last week</p>
                <p className={cn("flex items-center gap-1 font-heading text-2xl font-bold", delta === null ? "" : delta >= 0 ? "text-mint" : "text-coral")}>
                  {delta === null ? "—" : <>{delta >= 0 ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}{Math.abs(delta)} pts</>}
                </p>
              </div>
              <div className="rounded-xl bg-white/10 p-3">
                <p className="text-xs text-indigo-200">Assignments completed</p>
                <p className="font-heading text-2xl font-bold">{d.week.assignmentsCompleted}</p>
              </div>
              <div className="rounded-xl bg-white/10 p-3">
                <p className="text-xs text-indigo-200">Study days</p>
                <p className="font-heading text-2xl font-bold">{d.week.studyDays}/7</p>
              </div>
            </div>
            <Button asChild variant="sun" className="mt-4 w-full">
              <Link href="/parent/reports">Open weekly report</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Recent submissions</CardTitle>
            <Link href="/parent/submissions" className="text-sm font-semibold text-indigo-500 hover:text-indigo">View all →</Link>
          </CardHeader>
          <CardContent className="px-0 pb-2">
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-y bg-paper text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-5 py-2.5 font-semibold">Assignment</th>
                    <th className="px-3 py-2.5 font-semibold">Submitted</th>
                    <th className="px-3 py-2.5 font-semibold">Marks</th>
                    <th className="px-3 py-2.5 font-semibold">Status</th>
                    <th className="px-5 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {db.submissions.slice(0, 5).map((sub) => {
                    const a = db.assignments.find((x) => x.id === sub.assignmentId);
                    const e = db.evaluations.find((x) => x.id === sub.evaluationId);
                    return (
                      <tr key={sub.id} className="border-b last:border-0 hover:bg-paper">
                        <td className="px-5 py-3">
                          <p className="font-semibold">{a?.title}</p>
                          <p className="text-xs text-muted-foreground">{a && topicName(a.topicId)}</p>
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">{formatDate(sub.submittedAt)}</td>
                        <td className="px-3 py-3 font-semibold">{e ? `${e.parentOverride?.score ?? e.score}/${e.maxScore}` : "—"}</td>
                        <td className="px-3 py-3"><EvaluationStatusBadge status={sub.status} /></td>
                        <td className="px-5 py-3 text-right">
                          <Button asChild size="sm" variant="outline"><Link href={`/parent/submissions/${sub.id}`}>View report</Link></Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Topic performance</CardTitle>
            <p className="text-sm text-muted-foreground">Mastery across maths chapters</p>
          </CardHeader>
          <CardContent><TopicRadar data={d.radar} height={290} /></CardContent>
        </Card>
      </div>

      {/* Attention required */}
      <Card className="border-coral/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-coral-dark" /> Attention required</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><TrendingDown className="h-4 w-4 text-coral-dark" /> Weak topics</p>
            {d.weak.length ? d.weak.map((t) => (
              <div key={t.topicId} className="mb-1.5 flex justify-between rounded-lg bg-coral-light/40 px-3 py-2 text-sm"><span>{t.topicName}</span><b>{t.mastery}%</b></div>
            )) : <p className="text-sm text-muted-foreground">No weak topics 🎉</p>}
          </div>
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Repeat className="h-4 w-4 text-sun-dark" /> Repeated mistakes</p>
            {d.repeated.length ? d.repeated.map(([k, n]) => (
              <div key={k} className="mb-1.5 flex justify-between rounded-lg bg-sun-light/60 px-3 py-2 text-sm"><span>{ERROR_NAMES[k] ?? k}</span><b>{n}×</b></div>
            )) : <p className="text-sm text-muted-foreground">No repeated patterns.</p>}
          </div>
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><ClipboardList className="h-4 w-4 text-indigo" /> Pending homework</p>
            {d.pending.length ? d.pending.slice(0, 4).map((a) => (
              <Link key={a.id} href={`/parent/assignments/${a.id}`} className="mb-1.5 flex justify-between gap-2 rounded-lg bg-secondary px-3 py-2 text-sm hover:bg-lavender-dark">
                <span className="truncate">{a.title}</span>
                <span className={cn("shrink-0 text-xs font-semibold", a.live === "overdue" ? "text-coral-dark" : "text-muted-foreground")}>{a.live === "overdue" ? "Overdue" : a.live === "in_progress" ? "Started" : "Not started"}</span>
              </Link>
            )) : <p className="text-sm text-muted-foreground">All caught up.</p>}
          </div>
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><CalendarClock className="h-4 w-4 text-indigo" /> Deadlines approaching</p>
            {d.pending.filter((a) => a.live !== "overdue" && daysUntil(a.dueDate) <= 3).map((a) => (
              <div key={a.id} className="mb-1.5 flex justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
                <span className="truncate">{a.title}</span>
                <span className="shrink-0 text-xs font-semibold text-coral-dark">{dueLabel(a.dueDate)}</span>
              </div>
            ))}
            {d.pending.filter((a) => a.live !== "overdue" && daysUntil(a.dueDate) <= 3).length === 0 && <p className="text-sm text-muted-foreground">Nothing due in the next 3 days.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
