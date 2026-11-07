"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, Lightbulb, Loader2, X, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { practiceService } from "@/lib/client";
import type { AnswerResult, PracticeSession } from "@/lib/client/practice.service";
import { errorMessage } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import { topicName } from "@/lib/mock-data/curriculum";
import { playChime } from "@/lib/utils/sound";
import { usePauseCelebrations } from "@/components/shared/celebration";
import { useAppPrefs } from "@/hooks/use-data";

/**
 * Runs a practice session. Each answer is checked on the server (answers are never
 * sent to the browser in advance); the correct answer is revealed only afterwards.
 */
export function QuizRunner({
  session,
  onFinish,
  onQuit,
  finishing,
}: {
  session: PracticeSession;
  onFinish: () => void;
  onQuit: () => void;
  finishing: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [results, setResults] = useState<Record<string, AnswerResult>>({});
  const [checking, setChecking] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const startedAt = useRef(Date.now());
  const inputRef = useRef<HTMLInputElement>(null);
  const prefs = useAppPrefs();
  usePauseCelebrations();
  const item = session.items[index];
  const feedback = results[item.id];
  const isLast = index === session.items.length - 1;
  const progress = Math.round(((index + (feedback ? 1 : 0)) / session.items.length) * 100);

  useEffect(() => {
    inputRef.current?.focus();
    startedAt.current = Date.now();
  }, [index]);

  const check = async () => {
    if (!answer.trim() || checking) return;
    setChecking(true);
    try {
      const secs = Math.round((Date.now() - startedAt.current) / 1000);
      const r = await practiceService.answerQuestion(session.id, item.id, answer.trim(), Math.min(secs, 3600));
      setResults((prev) => ({ ...prev, [item.id]: r }));
      if (prefs?.soundEffects) playChime(r.correct ? "correct" : "wrong");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setChecking(false);
    }
  };

  const next = () => {
    if (isLast) {
      onFinish();
      return;
    }
    setIndex((i) => i + 1);
    setAnswer("");
    setShowHint(false);
  };

  const correctSoFar = Object.values(results).filter((r) => r.correct).length;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onQuit} aria-label="Quit practice">
          <X className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="h-3 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <motion.div className="h-full rounded-full bg-mint-dark" animate={{ width: `${progress}%` }} transition={{ duration: 0.4 }} />
          </div>
        </div>
        <span className="text-sm font-bold text-muted-foreground">
          {index + 1}/{session.items.length}
        </span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={item.id}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.25 }}
          className="rounded-3xl border bg-card p-5 shadow-soft sm:p-7"
        >
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {session.title} · {topicName(item.topicId)}
          </p>
          <h2 className="mt-3 font-heading text-xl font-semibold leading-snug sm:text-2xl">{item.text}</h2>

          <form
            className="mt-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (feedback) next();
              else void check();
            }}
          >
            <label htmlFor="answer" className="sr-only">Your answer</label>
            <Input
              id="answer"
              ref={inputRef}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              disabled={Boolean(feedback) || checking}
              placeholder="Type your answer…"
              autoComplete="off"
              maxLength={300}
              className={cn(
                "h-14 rounded-2xl text-lg font-semibold",
                feedback?.correct && "border-mint-dark bg-mint-light/60",
                feedback && !feedback.correct && "border-coral-dark bg-coral-light/50",
              )}
            />

            {!feedback && (
              <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                <Button type="button" variant="ghost" onClick={() => setShowHint(true)} disabled={showHint || !item.hint}>
                  <Lightbulb /> {showHint ? "Hint shown" : "Need a hint?"}
                </Button>
                <Button type="submit" size="lg" disabled={!answer.trim() || checking}>
                  {checking && <Loader2 className="animate-spin" />} Check answer
                </Button>
              </div>
            )}
          </form>

          <AnimatePresence>
            {showHint && !feedback && (
              <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-4 flex gap-2 rounded-xl bg-sun-light p-3 text-[15px]">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-sun-dark" /> {item.hint}
              </motion.p>
            )}
          </AnimatePresence>

          {feedback && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={cn("mt-5 rounded-2xl p-4", feedback.correct ? "bg-mint-light" : "bg-coral-light/60")}
              role="status"
            >
              <p className={cn("flex items-center gap-2 font-heading text-lg font-bold", feedback.correct ? "text-mint-dark" : "text-coral-dark")}>
                {feedback.correct ? <Check className="h-5 w-5" strokeWidth={3} /> : <XCircle className="h-5 w-5" />}
                {feedback.correct ? ["Brilliant!", "Spot on!", "You got it!", "Nailed it!"][index % 4] : "Not quite — let's learn from it"}
              </p>
              {!feedback.correct && <p className="mt-1 text-sm">Answer: <b>{feedback.answer}</b></p>}
              {feedback.explanation && <p className="mt-1.5 text-[15px]">{feedback.explanation}</p>}
              <Button onClick={next} size="lg" className="mt-4 w-full sm:w-auto" disabled={finishing}>
                {finishing ? <Loader2 className="animate-spin" /> : null}
                {isLast ? "Submit quiz" : "Next question"} {!finishing && <ArrowRight />}
              </Button>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
      <p className="mt-4 text-center text-sm text-muted-foreground">{correctSoFar} correct so far</p>
    </div>
  );
}
