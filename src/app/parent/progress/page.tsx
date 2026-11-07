"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/states";
import { KpiCard } from "@/components/parent/kpi-card";
import { ScoreTrendChart } from "@/components/charts/score-trend-chart";
import { SimpleBarChart, TopicBarChart } from "@/components/charts/bar-chart";
import { ConsistencyCalendar } from "@/components/student/consistency-calendar";
import { useWholeDB } from "@/hooks/use-data";
import { addDays, dayKey, formatDate, pct, startOfWeek } from "@/lib/utils";
import { CheckCircle2, Flame, Sparkles, Wrench } from "lucide-react";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ParentProgress() {
  const db = useWholeDB();
  const d = useMemo(() => {
    if (!db) return null;
    const evals = [...db.evaluations].sort((a, b) => a.evaluatedAt.localeCompare(b.evaluatedAt));
    const trend = evals.map((e) => ({ label: formatDate(e.evaluatedAt), score: pct(e.parentOverride?.score ?? e.score, e.maxScore) }));
    const start = startOfWeek();
    const weeklyMinutes = Array.from({ length: 6 }).map((_, i) => {
      const ws = addDays(start, -7 * (5 - i));
      let total = 0;
      for (let k = 0; k < 7; k++) total += db.studyMinutes[dayKey(addDays(ws, k))] ?? 0;
      return { label: i === 5 ? "This wk" : formatDate(ws.toISOString()), value: total };
    });
    const errorKinds = ["conceptual", "calculation", "incomplete", "notation"].map((k) => ({
      label: { conceptual: "Concept", calculation: "Calculation", incomplete: "Incomplete", notation: "Notation" }[k]!,
      value: evals.reduce((s, e) => s + e.results.filter((r) => r.errors.some((x) => x.kind === k)).length, 0),
    }));
    return { trend, weeklyMinutes, errorKinds };
  }, [db]);

  if (!db || !d) return <PageSkeleton />;
  const s = db.student;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Analytics" title="Student progress" description={`Detailed academic analytics for ${s.name}.`} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard icon={CheckCircle2} label="Evaluated assignments" value={db.evaluations.length} />
        <KpiCard icon={Wrench} label="Mistakes corrected" value={s.mistakesCorrected} sub="via retry practice" />
        <KpiCard icon={Flame} label="Longest streak" value={`${s.longestStreak} days`} sub={`Current: ${s.streak}`} />
        <KpiCard icon={Sparkles} label="Practice sessions" value={db.practiceResults.length} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Homework scores</CardTitle><p className="text-sm text-muted-foreground">Percentage per evaluated assignment</p></CardHeader>
          <CardContent><ScoreTrendChart data={d.trend} height={250} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Weekly study time</CardTitle><p className="text-sm text-muted-foreground">Total minutes per week</p></CardHeader>
          <CardContent><SimpleBarChart data={d.weeklyMinutes} height={250} name="Minutes" highlightIndex={5} /></CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader><CardTitle>Topic-wise accuracy</CardTitle></CardHeader>
          <CardContent>
            <TopicBarChart data={db.topicProgress.map((t) => ({ topic: t.topicName.replace("Understanding ", ""), score: t.accuracy }))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Mistake types</CardTitle><p className="text-sm text-muted-foreground">Questions affected, across all homework</p></CardHeader>
          <CardContent><SimpleBarChart data={d.errorKinds} height={250} name="Questions" /></CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Study consistency</CardTitle></CardHeader>
          <CardContent><ConsistencyCalendar minutes={db.studyMinutes} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Topic mastery detail</CardTitle></CardHeader>
          <CardContent className="relative overflow-x-auto px-0">
            <table className="w-full min-w-[340px] text-sm">
              <thead>
                <tr className="border-y bg-paper text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-2 font-semibold">Topic</th>
                  <th className="px-2 py-2 text-right font-semibold">Accuracy</th>
                  <th className="px-2 py-2 text-right font-semibold">Mastery</th>
                  <th className="px-5 py-2 text-right font-semibold">Trend</th>
                </tr>
              </thead>
              <tbody>
                {db.topicProgress.map((t) => {
                  const T = t.trend === "up" ? TrendingUp : t.trend === "down" ? TrendingDown : Minus;
                  return (
                    <tr key={t.topicId} className="border-b last:border-0">
                      <td className="px-5 py-2.5 font-medium">{t.topicName}</td>
                      <td className="px-2 py-2.5 text-right">{t.attempts ? `${t.accuracy}%` : "—"}</td>
                      <td className="px-2 py-2.5 text-right font-semibold">{t.attempts ? `${t.mastery}%` : "—"}</td>
                      <td className="px-5 py-2.5 text-right">
                        <T className={cn("ml-auto h-4 w-4", t.trend === "up" ? "text-mint-dark" : t.trend === "down" ? "text-coral-dark" : "text-muted-foreground")} aria-label={t.trend} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
