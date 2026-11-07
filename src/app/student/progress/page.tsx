"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Award, CheckCircle2, Flag, Rocket, Star, TrendingUp, Wrench } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/states";
import { StatTile } from "@/components/student/stat-tile";
import { ScoreTrendChart } from "@/components/charts/score-trend-chart";
import { SimpleBarChart } from "@/components/charts/bar-chart";
import { ConsistencyCalendar } from "@/components/student/consistency-calendar";
import { TopicProgressList } from "@/components/student/topic-progress-list";
import { ScoreRing } from "@/components/evaluation/score-ring";
import { useAssignmentsRaw, useEvaluations, usePracticeResults, useStudent, useStudyMinutes, useTopicProgress } from "@/hooks/use-data";
import { addDays, dayKey, formatDate, pct, startOfWeek, WEEKDAYS_SHORT } from "@/lib/utils";
import { topicName } from "@/lib/mock-data/curriculum";

export default function ProgressPage() {
  const student = useStudent();
  const evals = useEvaluations();
  const assignments = useAssignmentsRaw();
  const topics = useTopicProgress();
  const minutes = useStudyMinutes();
  const practice = usePracticeResults();

  const data = useMemo(() => {
    if (!evals || !assignments || !minutes || !practice) return null;
    const sorted = [...evals].sort((a, b) => a.evaluatedAt.localeCompare(b.evaluatedAt));
    const journey = sorted.map((e) => {
      const a = assignments.find((x) => x.id === e.assignmentId);
      return { e, a, p: pct(e.parentOverride?.score ?? e.score, e.maxScore) };
    });
    const homeworkTrend = journey.map((j) => ({ label: formatDate(j.e.evaluatedAt), score: j.p }));
    const overall = journey.length ? Math.round(journey.reduce((s, j) => s + j.p, 0) / journey.length) : 0;
    const start = startOfWeek();
    const weekly = WEEKDAYS_SHORT.map((d, i) => ({ label: d, value: minutes[dayKey(addDays(start, i))] ?? 0 }));
    const todayIdx = (new Date().getDay() + 6) % 7;
    // Monthly: average score per week for the last 5 weeks (homework + practice)
    const monthly = Array.from({ length: 5 }).map((_, i) => {
      const ws = addDays(start, -7 * (4 - i));
      const we = addDays(ws, 7);
      const inW = (iso: string) => new Date(iso) >= ws && new Date(iso) < we;
      const scores = [
        ...evals.filter((e) => inW(e.evaluatedAt)).map((e) => pct(e.parentOverride?.score ?? e.score, e.maxScore)),
        ...practice.filter((p) => inW(p.completedAt)).map((p) => pct(p.correct, p.total)),
      ];
      return { label: i === 4 ? "This wk" : `${formatDate(ws.toISOString())}`, score: scores.length ? Math.round(scores.reduce((s, x) => s + x, 0) / scores.length) : 0 };
    });
    const mistakesTotal = evals.reduce((s, e) => s + e.results.filter((r) => r.status !== "correct").length, 0);
    return { journey, homeworkTrend, overall, weekly, todayIdx, monthly, mistakesTotal };
  }, [evals, assignments, minutes, practice]);

  if (!student || !data || !topics || !minutes) return <PageSkeleton />;
  const studied = topics.filter((t) => t.attempts > 0);
  const strongest = [...studied].sort((a, b) => b.mastery - a.mastery).slice(0, 3);
  const weakest = [...studied].sort((a, b) => a.mastery - b.mastery).slice(0, 3);
  const weekMinutes = data.weekly.reduce((s, d) => s + d.value, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="My Progress" description="See how much you've grown. Every bar here is your hard work!" />

      <section className="grid gap-4 lg:grid-cols-[auto_1fr]">
        <Card className="flex items-center gap-5 p-5">
          <ScoreRing percentage={data.overall} size={120} stroke={11} color="#292B59" track="#E4E3F4">
            <span className="font-heading text-3xl font-bold">{data.overall}%</span>
            <span className="text-[11px] font-semibold text-muted-foreground">average</span>
          </ScoreRing>
          <div>
            <p className="text-sm font-semibold text-muted-foreground">Overall homework score</p>
            <p className="mt-1 font-heading text-xl font-bold">
              {data.overall >= 80 ? "Excellent! 🌟" : data.overall >= 65 ? "Doing great! 💪" : "Growing every day 🌱"}
            </p>
            {data.journey.length >= 2 && (
              <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-mint-dark">
                <TrendingUp className="h-4 w-4" /> Up {Math.max(0, data.journey[data.journey.length - 1].p - data.journey[0].p)} points since your first mission
              </p>
            )}
          </div>
        </Card>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile icon={CheckCircle2} tone="mint" label="Assignments done" value={data.journey.length} />
          <StatTile icon={Wrench} tone="coral" label="Mistakes corrected" value={student.mistakesCorrected} hint={`of ${data.mistakesTotal} found`} delay={0.05} />
          <StatTile icon={Rocket} tone="sun" label="Practice sessions" value={practice?.length ?? 0} delay={0.1} />
          <StatTile icon={Flag} tone="lavender" label="Minutes this week" value={weekMinutes} delay={0.15} />
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>How my scores are changing</CardTitle>
          <p className="text-sm text-muted-foreground">Higher is better! Hover or tap a dot to see the score.</p>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="homework">
            <TabsList className="grid w-full grid-cols-3 sm:inline-grid sm:w-auto">
              <TabsTrigger value="homework" className="px-2 text-xs sm:px-3 sm:text-sm">
                <span className="sm:hidden">Homework</span><span className="hidden sm:inline">Each homework</span>
              </TabsTrigger>
              <TabsTrigger value="monthly" className="px-2 text-xs sm:px-3 sm:text-sm">
                <span className="sm:hidden">5 weeks</span><span className="hidden sm:inline">Last 5 weeks</span>
              </TabsTrigger>
              <TabsTrigger value="weekly" className="px-2 text-xs sm:px-3 sm:text-sm">This week</TabsTrigger>
            </TabsList>
            <TabsContent value="homework">
              <ScoreTrendChart data={data.homeworkTrend} height={240} />
            </TabsContent>
            <TabsContent value="monthly">
              <ScoreTrendChart data={data.monthly} height={240} name="Avg score" />
            </TabsContent>
            <TabsContent value="weekly">
              <p className="mb-2 text-sm text-muted-foreground">Minutes studied each day this week</p>
              <SimpleBarChart data={data.weekly} height={240} unit="" name="Minutes" highlightIndex={data.todayIdx} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Study calendar</CardTitle>
            <p className="text-sm text-muted-foreground">Green days are days you studied. Keep the chain going!</p>
          </CardHeader>
          <CardContent>
            <ConsistencyCalendar minutes={minutes} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Topic accuracy</CardTitle>
            <p className="text-sm text-muted-foreground">How often you get each topic right</p>
          </CardHeader>
          <CardContent>
            <TopicProgressList topics={topics.map((t) => ({ ...t, mastery: t.accuracy }))} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-mint">
          <CardHeader><CardTitle className="flex items-center gap-2"><Star className="h-5 w-5 text-sun-dark" /> My superpowers</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {strongest.map((t) => (
              <div key={t.topicId} className="flex items-center justify-between rounded-xl bg-mint-light/70 px-3 py-2.5">
                <span className="font-semibold">{t.topicName}</span>
                <span className="font-heading font-bold text-mint-dark">{t.mastery}%</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="border-coral/50">
          <CardHeader><CardTitle className="flex items-center gap-2"><Award className="h-5 w-5 text-coral-dark" /> Level-up zones</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {weakest.map((t) => (
              <div key={t.topicId} className="flex items-center justify-between rounded-xl bg-coral-light/50 px-3 py-2.5">
                <span className="font-semibold">{t.topicName}</span>
                <span className="font-heading font-bold text-coral-dark">{t.mastery}%</span>
              </div>
            ))}
            <p className="pt-1 text-xs text-muted-foreground">Try the Weak-Topic Booster in Practice to level these up.</p>
          </CardContent>
        </Card>
      </div>

      {/* Learning journey */}
      <Card>
        <CardHeader>
          <CardTitle>My learning journey</CardTitle>
          <p className="text-sm text-muted-foreground">Every mission you&apos;ve completed, from your first to your latest.</p>
        </CardHeader>
        <CardContent>
          <ol className="relative ml-4 border-l-2 border-dashed border-indigo-200">
            {data.journey.map((j, i) => {
              const prev = data.journey[i - 1];
              const diff = prev ? j.p - prev.p : 0;
              return (
                <motion.li key={j.e.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }} className="relative mb-5 pl-7 last:mb-0">
                  <span className="absolute -left-[13px] top-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-card bg-indigo text-[10px] font-bold text-white">{i + 1}</span>
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card p-3">
                    <div>
                      <p className="font-semibold">{j.a?.title}</p>
                      <p className="text-xs text-muted-foreground">{j.a && topicName(j.a.topicId)} · {formatDate(j.e.evaluatedAt)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {prev && (
                        <span className={`text-xs font-bold ${diff >= 0 ? "text-mint-dark" : "text-coral-dark"}`}>
                          {diff >= 0 ? "▲" : "▼"} {Math.abs(diff)}
                        </span>
                      )}
                      <span className="rounded-full bg-secondary px-2.5 py-1 font-heading text-sm font-bold">{j.p}%</span>
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
