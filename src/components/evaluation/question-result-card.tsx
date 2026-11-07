"use client";

import { useState } from "react";
import { ChevronDown, CircleCheck, CircleX, Lightbulb, AlertTriangle, PenLine, BadgeCheck } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ResultStatusBadge } from "@/components/shared/status-badge";
import type { ErrorKind, QuestionResult } from "@/types";
import { cn } from "@/lib/utils";

const ERROR_LABEL: Record<ErrorKind, string> = {
  conceptual: "Concept mix-up",
  calculation: "Calculation slip",
  incomplete: "Incomplete working",
  notation: "Notation / units",
  method: "Method choice",
  misread: "Misread the question",
};

const ring = { correct: "bg-mint-dark", partial: "bg-sun-dark", incorrect: "bg-coral-dark" } as const;

export function QuestionResultCard({ r, defaultOpen, footer }: { r: QuestionResult; defaultOpen?: boolean; footer?: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen ?? r.status !== "correct");
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="overflow-hidden rounded-2xl border bg-card shadow-soft">
      <CollapsibleTrigger className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-heading font-bold text-white", ring[r.status])}>
          Q{r.number}
        </span>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[15px] font-medium leading-snug">{r.question}</p>
          <div className="mt-1.5">
            <ResultStatusBadge status={r.status} />
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-heading text-xl font-bold leading-none">
            {r.marksAwarded}
            <span className="text-sm font-semibold text-muted-foreground">/{r.maxMarks}</span>
          </p>
          <ChevronDown className={cn("ml-auto mt-1 h-5 w-5 text-indigo-300 transition-transform", open && "rotate-180")} />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
        <div className="space-y-4 border-t px-4 pb-5 pt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border bg-paper p-3">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground"><PenLine className="h-3.5 w-3.5" /> Your answer</p>
              <p className="mt-1.5 font-medium">{r.studentAnswer}</p>
            </div>
            <div className="rounded-xl border border-mint bg-mint-light/50 p-3">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-mint-dark"><BadgeCheck className="h-3.5 w-3.5" /> Expected answer</p>
              <p className="mt-1.5 font-medium">{r.expectedAnswer}</p>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold">Step-wise marking</p>
            <ul className="space-y-1.5">
              {r.steps.map((s, i) => (
                <li key={i} className="flex items-center gap-2.5 rounded-lg bg-secondary/50 px-3 py-2 text-sm">
                  {s.ok ? <CircleCheck className="h-4 w-4 shrink-0 text-mint-dark" /> : <CircleX className="h-4 w-4 shrink-0 text-coral-dark" />}
                  <span className="flex-1">{s.description}</span>
                  <span className="font-semibold">{s.awarded}/{s.max}</span>
                </li>
              ))}
            </ul>
          </div>

          {r.errors.length > 0 && (
            <div className="space-y-2">
              {r.errors.map((e, i) => (
                <div key={i} className="flex gap-2.5 rounded-xl border border-coral/40 bg-coral-light/40 p-3 text-sm">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-coral-dark" />
                  <div>
                    <p className="font-semibold text-coral-dark">{ERROR_LABEL[e.kind]}</p>
                    <p>{e.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3 rounded-xl bg-lavender p-3.5">
            <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-sun-dark" />
            <div>
              <p className="text-sm font-semibold">Arthu explains</p>
              <p className="mt-0.5 text-[15px] leading-relaxed">{r.explanation}</p>
            </div>
          </div>
          {r.feedback && (
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                ["What went wrong", r.feedback.whatWentWrong],
                ["Why it's not right", r.feedback.whyIncorrect],
                ["The right approach", r.feedback.correctApproach],
                ["Next time", r.feedback.howToAvoid],
              ]
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k} className="rounded-xl border bg-paper p-3 text-sm">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{k}</p>
                    <p className="mt-1">{v}</p>
                  </div>
                ))}
              {r.feedback.example && (
                <div className="rounded-xl border border-mint bg-mint-light/40 p-3 text-sm sm:col-span-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-mint-dark">Example</p>
                  <p className="mt-1 whitespace-pre-line">{r.feedback.example}</p>
                </div>
              )}
            </div>
          )}

          {r.recommendedPractice && r.recommendedPractice.length > 0 && (
            <div className="text-sm">
              <p className="mb-1 font-semibold">Try these</p>
              <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">{r.recommendedPractice.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
          )}

          {r.needsReview && (
            <p className="rounded-lg bg-sun-light px-3 py-2 text-xs font-medium text-sun-dark">A parent will double-check this question.</p>
          )}
          {r.verificationNote && <p className="text-xs text-muted-foreground">Exact check: {r.verificationNote}</p>}

          {footer}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
