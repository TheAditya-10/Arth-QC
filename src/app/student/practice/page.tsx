"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { CalendarDays, Check, Flame, Loader2, Play, RotateCcw, Sparkles, Swords, Target, Trophy, Wrench, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/states";
import { Mascot } from "@/components/shared/mascot";
import { Confetti } from "@/components/shared/celebration";
import { QuizRunner } from "@/components/student/quiz-runner";
import { usePracticeResults, useTopicProgress } from "@/hooks/use-data";
import { practiceService } from "@/lib/client";
import type { PracticeSession, SessionResult } from "@/lib/client/practice.service";
import { errorMessage } from "@/lib/client/api";
import { SUBJECTS, TOPICS, topicName } from "@/lib/mock-data/curriculum";
import type { Difficulty, PracticeSessionConfig, SubjectId } from "@/types";
import { cn, dayKey, pct, relativeTime } from "@/lib/utils";

const SPECIALS = [
  { mode: "daily", icon: CalendarDays, tone: "bg-sun text-indigo" },
  { mode: "weak", icon: Target, tone: "bg-coral text-white" },
  { mode: "revision", icon: RotateCcw, tone: "bg-mint text-mint-dark" },
  { mode: "weekly", icon: Swords, tone: "bg-indigo text-sun" },
] as const;

function PracticeInner() {
  const params = useSearchParams();
  const router = useRouter();
  const topics = useTopicProgress();
  const history = usePracticeResults();
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [result, setResult] = useState<{ r: SessionResult; session: PracticeSession } | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [subject, setSubject] = useState<SubjectId>("mathematics");
  const [topicId, setTopicId] = useState<string>("mixed");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [count, setCount] = useState(5);

  const retryId = params.get("retry");
  useEffect(() => {
    if (!retryId || !topics) return;
    router.replace("/student/practice");
    setStarting(true);
    practiceService
      .buildRetrySession(retryId === "mistakes" ? undefined : retryId)
      .then((s) => setSession(s))
      .catch((e) => toast.info(errorMessage(e)))
      .finally(() => setStarting(false));
  }, [retryId, topics, router]);

  const dailyDoneToday = useMemo(
    () => history?.some((h) => h.config.mode === "daily" && dayKey(h.completedAt) === dayKey()) ?? false,
    [history],
  );

  if (!topics || !history) return <PageSkeleton />;
  if (starting) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center" role="status">
        <Loader2 className="h-10 w-10 animate-spin text-indigo" />
        <p className="mt-4 font-heading text-lg font-semibold">Preparing your questions…</p>
      </div>
    );
  }

  const start = async (config: PracticeSessionConfig) => {
    setStarting(true);
    try {
      const s = await practiceService.buildSession(config);
      setResult(null);
      setSession(s);
    } catch (e) {
      toast.error(errorMessage(e, "Couldn't start practice. Please try again."));
    } finally {
      setStarting(false);
    }
  };

  const finish = async () => {
    if (!session) return;
    setFinishing(true);
    try {
      const r = await practiceService.completeSession(session);
      setResult({ r, session });
      setSession(null);
    } catch (e) {
      toast.error(errorMessage(e, "Couldn't save your quiz. Please try again."));
    } finally {
      setFinishing(false);
    }
  };

  if (session) {
    return (
      <QuizRunner
        session={session}
        finishing={finishing}
        onFinish={finish}
        onQuit={() => {
          practiceService.abandonSession(session.id);
          setSession(null);
          toast("Practice paused", { description: "No worries — come back any time." });
        }}
      />
    );
  }

  if (result) {
    const { r, session: s } = result;
    const p = pct(r.correct, r.total);
    return (
      <div className="mx-auto max-w-2xl">
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="relative overflow-hidden rounded-3xl bg-indigo p-6 text-center text-white sm:p-8">
          {p >= 60 && <Confetti />}
          <Mascot mood={p >= 60 ? "celebrate" : "happy"} className="relative mx-auto h-24 w-24" />
          <p className="relative mt-3 text-sm font-semibold text-indigo-200">{s.title} complete!</p>
          <h1 className="relative mt-1 font-heading text-4xl font-bold">{r.correct}/{r.total} correct</h1>
          <p className="relative mt-2 text-indigo-100">
            {p === 100 ? "Perfect score! You're unstoppable." : p >= 60 ? "Great job! Keep that brain buzzing." : "Good try! Every attempt makes you stronger."}
          </p>
          <div className="relative mt-5 flex flex-wrap justify-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-sun px-4 py-1.5 font-bold text-indigo"><Sparkles className="h-4 w-4" /> +{r.xpEarned} XP</span>
            <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-1.5 font-semibold"><Flame className="h-4 w-4 text-coral" /> Streak updated</span>
          </div>
        </motion.div>
        <Card className="mt-5">
          <CardHeader><CardTitle>Review</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {r.review.map((it, i) => {
                const at = { correct: it.correct, answer: it.studentAnswer };
                return (
                  <li key={it.questionId} className="flex items-start gap-3 rounded-xl border p-3">
                    <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white", at?.correct ? "bg-mint-dark" : "bg-coral-dark")}>
                      {at?.correct ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <X className="h-3.5 w-3.5" strokeWidth={3} />}
                    </span>
                    <div className="min-w-0 text-sm">
                      <p className="font-medium">{i + 1}. {it.text}</p>
                      <p className="mt-0.5 text-muted-foreground">
                        You: <b className="text-foreground">{at?.answer || "—"}</b> · Answer: <b className="text-foreground">{it.answer}</b>
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Button size="lg" onClick={() => start(s.config)} disabled={Boolean(s.retryOf)}><RotateCcw /> Practise again</Button>
              <Button size="lg" variant="outline" onClick={() => setResult(null)}>Back to practice centre</Button>
              <Button size="lg" variant="ghost" asChild><Link href="/student">Home</Link></Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const weakest = [...topics].filter((t) => t.attempts > 0).sort((a, b) => a.mastery - b.mastery).slice(0, 2);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Practice Centre"
        description="Quick-fire questions to sharpen your skills. Every correct answer = XP!"
        actions={
          <Button variant="outline" onClick={() => router.push("/student/practice?retry=mistakes")}>
            <Wrench /> Fix my mistakes
          </Button>
        }
      />

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {SPECIALS.map((sp, i) => {
          const meta = practiceService.SPECIAL_MODES[sp.mode];
          const done = sp.mode === "daily" && dailyDoneToday;
          return (
            <motion.button
              key={sp.mode}
              type="button"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ y: -3 }}
              onClick={() => start({ subjectId: "mathematics", topicId: "mixed", difficulty: "medium", count: meta.count, mode: sp.mode })}
              className="group flex flex-col rounded-2xl border bg-card p-4 text-left shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-center justify-between">
                <span className={cn("flex h-11 w-11 items-center justify-center rounded-xl", sp.tone)}><sp.icon className="h-5 w-5" /></span>
                <span className="rounded-full bg-sun-light px-2 py-0.5 text-xs font-bold text-sun-dark">{meta.xp}</span>
              </div>
              <p className="mt-3 font-heading text-lg font-semibold">{meta.title}</p>
              <p className="text-sm text-muted-foreground">
                {sp.mode === "weak" && weakest.length ? `Focus: ${weakest.map((w) => w.topicName).join(" & ")}` : meta.description}
              </p>
              <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-indigo">
                {done ? <><Check className="h-4 w-4 text-mint-dark" /> Done today · play again</> : <><Play className="h-4 w-4" /> Start · {meta.count} questions</>}
              </p>
            </motion.button>
          );
        })}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-sun-dark" /> Build your own practice</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Select value={subject} onValueChange={(v) => setSubject(v as SubjectId)}>
                  <SelectTrigger id="subject"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SUBJECTS.map((s) => (
                      <SelectItem key={s.id} value={s.id} disabled={!s.enabled}>{s.name}{!s.enabled && " (coming soon)"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ptopic">Topic</Label>
                <Select value={topicId} onValueChange={setTopicId}>
                  <SelectTrigger id="ptopic"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mixed">🎲 Mixed — all topics</SelectItem>
                    {TOPICS.filter((t) => t.subjectId === subject).map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Difficulty</Label>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Difficulty">
                {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    role="radio"
                    aria-checked={difficulty === d}
                    onClick={() => setDifficulty(d)}
                    className={cn(
                      "rounded-xl border-2 py-3 text-sm font-bold capitalize transition",
                      difficulty === d ? "border-indigo bg-lavender text-indigo" : "border-transparent bg-secondary/60 text-indigo-400 hover:bg-secondary",
                    )}
                  >
                    {d === "easy" ? "🌱" : d === "medium" ? "🔥" : "🚀"} {d}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Number of questions</Label>
              <div className="flex gap-2" role="radiogroup" aria-label="Number of questions">
                {[3, 5, 8, 10].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={count === n}
                    onClick={() => setCount(n)}
                    className={cn(
                      "h-11 flex-1 rounded-xl border-2 font-heading font-bold transition",
                      count === n ? "border-indigo bg-indigo text-white" : "border-transparent bg-secondary/60 text-indigo-400 hover:bg-secondary",
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <Button size="lg" variant="sun" className="w-full" onClick={() => start({ subjectId: subject, topicId, difficulty, count, mode: "custom" })}>
              <Play className="fill-current" /> Start practice
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-sun-dark" /> Recent sessions</CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No practice yet. Start your first session!</p>
            ) : (
              <ul className="space-y-2">
                {history.slice(0, 6).map((h) => {
                  const p = pct(h.correct, h.total);
                  return (
                    <li key={h.id} className="flex items-center gap-3 rounded-xl border p-3">
                      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-heading text-sm font-bold", p >= 80 ? "bg-mint-light text-mint-dark" : p >= 60 ? "bg-sun-light text-sun-dark" : "bg-coral-light text-coral-dark")}>
                        {p}%
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {h.title ?? (h.config.mode === "custom" ? topicName(h.config.topicId) : practiceService.SPECIAL_MODES[h.config.mode].title)}
                        </p>
                        <p className="text-xs text-muted-foreground">{h.correct}/{h.total} correct · {relativeTime(h.completedAt)}</p>
                      </div>
                      <span className="text-xs font-bold text-sun-dark">+{h.xpEarned} XP</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function PracticePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PracticeInner />
    </Suspense>
  );
}
