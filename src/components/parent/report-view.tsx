"use client";

import { ArrowDownRight, ArrowUpRight, CalendarCheck, CheckCircle2, Clock, Compass, Sparkles, Wrench } from "lucide-react";
import type { WeeklyReport } from "@/types";
import { SimpleBarChart, TopicBarChart } from "@/components/charts/bar-chart";
import { ScoreTrendChart } from "@/components/charts/score-trend-chart";
import { LogoMark } from "@/components/shared/logo";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function ReportView({ report, studentName, trend, className, options = { topics: true, mistakes: true } }: { report: WeeklyReport; studentName: string; trend: { label: string; score: number }[]; className?: string; options?: { topics: boolean; mistakes: boolean } }) {
  const delta = report.averageScore && report.previousAverageScore ? report.averageScore - report.previousAverageScore : null;
  const tiles = [
    { icon: Sparkles, label: "Average score", value: report.averageScore ? `${report.averageScore}%` : "—" },
    { icon: CheckCircle2, label: "Assignments", value: `${report.assignmentsCompleted}/${report.assignmentsAssigned || report.assignmentsCompleted}` },
    { icon: CalendarCheck, label: "Study days", value: `${report.studyDays}/7` },
    { icon: Clock, label: "Study time", value: `${report.studyMinutes} min` },
    ...(options.mistakes ? [{ icon: Wrench, label: "Mistakes corrected", value: report.mistakesCorrected }] : []),
  ];
  return (
    <article className={cn("rounded-2xl border bg-card p-5 sm:p-7", className)} aria-label="Weekly report">
      <header className="flex flex-col gap-3 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <LogoMark className="h-10 w-10" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Arth-QC weekly report</p>
            <h2 className="font-heading text-2xl font-bold">{studentName} · Mathematics</h2>
          </div>
        </div>
        <p className="text-sm font-medium text-muted-foreground">{formatDate(report.weekStart, { day: "numeric", month: "short" })} – {formatDate(report.weekEnd, { day: "numeric", month: "short", year: "numeric" })}</p>
      </header>

      <section className="mt-5">
        <h3 className="mb-3 font-heading text-lg font-semibold">Performance overview</h3>
        <div className={cn("grid grid-cols-2 gap-3", options.mistakes ? "md:grid-cols-5" : "md:grid-cols-4")}>
          {tiles.map((t) => (
            <div key={t.label} className="rounded-xl bg-paper p-3">
              <t.icon className="h-4 w-4 text-indigo-400" />
              <p className="mt-1.5 font-heading text-xl font-bold">{t.value}</p>
              <p className="text-xs text-muted-foreground">{t.label}</p>
            </div>
          ))}
        </div>
        {delta !== null && (
          <p className={cn("mt-3 flex items-center gap-1.5 text-sm font-semibold", delta >= 0 ? "text-mint-dark" : "text-coral-dark")}>
            {delta >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
            {Math.abs(delta)} points {delta >= 0 ? "higher" : "lower"} than the previous week ({report.previousAverageScore}%)
          </p>
        )}
      </section>

      <div className={cn("mt-6 grid gap-6", options.topics && "md:grid-cols-2")}>
        {options.topics && <section>
          <h3 className="mb-2 font-heading text-lg font-semibold">Topic-wise marks</h3>
          {report.topicScores.length ? (
            <TopicBarChart data={report.topicScores} />
          ) : (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No homework evaluated this week yet.</p>
          )}
        </section>}
        <section>
          <h3 className="mb-2 font-heading text-lg font-semibold">Study consistency</h3>
          <SimpleBarChart data={report.dailyMinutes.map((d) => ({ label: d.day, value: d.minutes }))} height={180} name="Minutes" />
        </section>
      </div>

      <section className="mt-6">
        <h3 className="mb-2 font-heading text-lg font-semibold">Improvement trend</h3>
        <p className="mb-2 text-sm text-muted-foreground">Weekly average score</p>
        <ScoreTrendChart data={trend} height={180} name="Weekly avg" />
      </section>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <section className="rounded-xl bg-mint-light/60 p-4">
          <h3 className="font-heading font-semibold">Highlights</h3>
          <ul className="mt-2 space-y-1.5 text-sm">
            {report.highlights.map((h) => <li key={h} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-mint-dark" /> {h}</li>)}
          </ul>
        </section>
        <section className="rounded-xl bg-lavender p-4">
          <h3 className="flex items-center gap-1.5 font-heading font-semibold"><Compass className="h-4 w-4" /> Recommended focus for next week</h3>
          <ul className="mt-2 space-y-1.5 text-sm">
            {report.focusNextWeek.length ? report.focusNextWeek.map((f) => <li key={f} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo" /> {f}</li>) : <li>Keep up the great consistency!</li>}
          </ul>
        </section>
      </div>
      <p className="mt-6 text-center text-xs text-muted-foreground">Generated by Arth-QC · Demo data</p>
    </article>
  );
}
