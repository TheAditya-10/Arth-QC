"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { refresh } from "@/lib/client/store";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, Loader2, MessageCircleHeart, RotateCcw, ShieldCheck, Sparkles, Target, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mascot } from "@/components/shared/mascot";
import { NotFoundState, PageSkeleton } from "@/components/shared/states";
import { Confetti } from "@/components/shared/celebration";
import { ScoreRing } from "@/components/evaluation/score-ring";
import { QuestionResultCard } from "@/components/evaluation/question-result-card";
import { useAssignmentsRaw, useEvaluations, useSubmissions } from "@/hooks/use-data";
import { topicName } from "@/lib/mock-data/curriculum";
import { formatDateTime, pct } from "@/lib/utils";
import { performanceMessage } from "@/lib/utils/gamification";

export default function EvaluationResults() {
  const { id } = useParams<{ id: string }>();
  const submissions = useSubmissions();
  const evaluations = useEvaluations();
  const assignments = useAssignmentsRaw();
  const [expandAll, setExpandAll] = useState<boolean | undefined>(undefined);
  const pending = submissions?.find((s) => s.id === id)?.status === "processing";

  // While the evaluation runs in the background, poll its status (which also nudges the worker).
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => {
      void api("GET", `/api/submissions/${id}/status`)
        .then((s) => {
          if ((s as { done?: boolean }).done) void refresh();
        })
        .catch(() => {});
    }, 4000);
    return () => clearInterval(t);
  }, [pending, id]);

  if (!submissions || !evaluations || !assignments) return <PageSkeleton cards={3} />;
  const sub = submissions.find((s) => s.id === id);
  if (!sub) return <NotFoundState what="submission" backHref="/student/homework" backLabel="Back to homework" />;
  const a = assignments.find((x) => x.id === sub.assignmentId);
  const e = evaluations.find((x) => x.id === sub.evaluationId);

  if (sub.status === "failed") {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <ShieldCheck className="mx-auto h-10 w-10 text-indigo" />
        <h1 className="mt-4 font-heading text-xl font-bold">Your homework is saved</h1>
        <p className="mt-1 text-muted-foreground">Arthu couldn&apos;t check it automatically this time, so a parent will review it. Great job finishing it!</p>
        <Button asChild className="mt-5"><Link href="/student/homework">Back to homework</Link></Button>
      </div>
    );
  }

  if (!e) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <Loader2 className="mx-auto h-10 w-10 animate-spin text-indigo" />
        <h1 className="mt-4 font-heading text-xl font-bold">Still checking your homework…</h1>
        <p className="mt-1 text-muted-foreground">This usually takes less than a minute. You can leave this page — we&apos;ll keep working.</p>
      </div>
    );
  }

  const score = e.parentOverride?.score ?? e.score;
  const p = pct(score, e.maxScore);
  const msg = performanceMessage(p);
  const counts = {
    correct: e.results.filter((r) => r.status === "correct").length,
    partial: e.results.filter((r) => r.status === "partial").length,
    incorrect: e.results.filter((r) => r.status === "incorrect").length,
  };
  const toRetry = counts.partial + counts.incorrect;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/student/homework" className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-500 hover:text-indigo">
        <ArrowLeft className="h-4 w-4" /> My Homework
      </Link>

      {/* Score hero */}
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-3xl bg-indigo p-6 text-white sm:p-8">
        {p >= 75 && <Confetti count={28} />}
        <div className="relative flex flex-col items-center gap-6 sm:flex-row">
          <ScoreRing percentage={p}>
            <span className="font-heading text-4xl font-bold">{p}%</span>
            <span className="text-xs font-semibold text-indigo-200">{score}/{e.maxScore} marks</span>
          </ScoreRing>
          <div className="flex-1 text-center sm:text-left">
            <p className="text-sm font-semibold text-indigo-200">{a?.title} · {a && topicName(a.topicId)}</p>
            <h1 className="mt-1 font-heading text-2xl font-bold sm:text-3xl">{msg.title}</h1>
            <p className="mt-2 text-indigo-100">{e.summary}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
              <span className="flex items-center gap-1.5 rounded-full bg-sun px-3 py-1 text-sm font-bold text-indigo"><Sparkles className="h-4 w-4" /> +{e.xpEarned} XP earned</span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-sm">{counts.correct} correct · {counts.partial} partial · {counts.incorrect} to fix</span>
            </div>
          </div>
          <Mascot mood={p >= 75 ? "celebrate" : "happy"} className="hidden h-28 w-28 lg:block" />
        </div>
      </motion.section>

      {e.needsReview && !e.parentOverride && (
        <div className="flex items-start gap-3 rounded-2xl border border-sun bg-sun-light/50 p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-sun-dark" />
          <div className="text-sm">
            <p className="font-semibold">Some answers will be double-checked</p>
            <p className="text-muted-foreground">Arthu wasn&apos;t 100% sure about a few answers, so Mumma or Papa will review them. Your marks may change a little.</p>
          </div>
        </div>
      )}

      {e.parentOverride && (
        <div className="flex items-start gap-3 rounded-2xl border bg-card p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-indigo" />
          <div className="text-sm">
            <p className="font-semibold">Reviewed by your parent</p>
            <p className="text-muted-foreground">{e.parentOverride.note || "Marks were checked and updated."}</p>
          </div>
        </div>
      )}

      {/* Questions */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-xl font-bold">Question by question</h2>
          <Button variant="ghost" size="sm" onClick={() => setExpandAll((v) => !v)}>
            {expandAll ? "Collapse all" : "Expand all"}
          </Button>
        </div>
        <div className="space-y-3">
          {e.results.map((r) => (
            <QuestionResultCard key={`${r.questionId}-${String(expandAll)}`} r={r} defaultOpen={expandAll} />
          ))}
        </div>
      </section>

      {/* Improvement */}
      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ThumbsUp className="h-5 w-5 text-mint-dark" /> You understood well</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {e.strengths.map((s) => (
                <li key={s} className="flex items-start gap-2 text-[15px]"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-mint-dark" /> {s}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-coral-dark" /> Let&apos;s work on</CardTitle>
          </CardHeader>
          <CardContent>
            {e.needsAttention.length ? (
              <ul className="space-y-2">
                {e.needsAttention.map((s) => (
                  <li key={s} className="flex items-start gap-2 text-[15px]"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-coral-dark" /> {s}</li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">Nothing — perfect score! 🌟</p>
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Try these next</CardTitle>
          <p className="text-sm text-muted-foreground">Similar questions to make your weak spots strong.</p>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2">
            {e.suggestedPractice.map((q, i) => (
              <li key={q} className="flex gap-3 rounded-xl bg-secondary/60 p-3 text-[15px]">
                <span className="font-heading font-bold text-indigo-400">{i + 1}.</span> {q}
              </li>
            ))}
          </ol>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            {toRetry > 0 && (
              <Button asChild size="lg" variant="sun">
                <Link href={`/student/practice?retry=${e.id}`}><RotateCcw /> Retry {toRetry} question{toRetry > 1 ? "s" : ""}</Link>
              </Button>
            )}
            <Button asChild size="lg" variant="outline">
              <Link href="/student/ai-buddy"><MessageCircleHeart /> Ask Arthu for help</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">Submitted {formatDateTime(sub.submittedAt)} · Evaluated {formatDateTime(e.evaluatedAt)}</p>
    </div>
  );
}
