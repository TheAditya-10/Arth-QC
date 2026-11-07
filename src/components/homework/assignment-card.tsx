"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { CalendarClock, ChevronRight, Clock, ListChecks } from "lucide-react";
import type { AssignmentView } from "@/hooks/use-data";
import { topicName } from "@/lib/mock-data/curriculum";
import { cn, dueLabel, daysUntil } from "@/lib/utils";
import { AssignmentStatusBadge, DifficultyBadge } from "@/components/shared/status-badge";

const accent: Record<string, string> = {
  pending: "bg-indigo",
  in_progress: "bg-sun",
  overdue: "bg-coral",
  submitted: "bg-lavender-dark",
  evaluated: "bg-mint-dark",
};

export function AssignmentCard({ a, href, index = 0 }: { a: AssignmentView; href: string; index?: number }) {
  const urgent = a.live !== "evaluated" && a.live !== "submitted" && daysUntil(a.dueDate) <= 1;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
      <Link
        href={href}
        className="group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-card p-4 pl-5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className={cn("absolute inset-y-0 left-0 w-1.5", accent[a.live])} aria-hidden />
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Maths · {topicName(a.topicId)}</p>
            <h3 className="mt-1 font-heading text-lg font-semibold leading-snug">{a.title}</h3>
          </div>
          <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-indigo-300 transition group-hover:translate-x-0.5 group-hover:text-indigo" />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <AssignmentStatusBadge status={a.live} />
          <DifficultyBadge difficulty={a.difficulty} />
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5"><ListChecks className="h-4 w-4" />{a.questions.length} questions</span>
          <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" />{a.estimatedMinutes} min</span>
          <span className={cn("flex items-center gap-1.5", urgent && "font-semibold text-coral-dark")}>
            <CalendarClock className="h-4 w-4" />
            {a.live === "evaluated" || a.live === "submitted" ? "Done" : dueLabel(a.dueDate)}
          </span>
        </div>
        {a.live === "in_progress" && a.progress !== undefined && (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-sun-dark" style={{ width: `${a.progress}%` }} />
          </div>
        )}
      </Link>
    </motion.div>
  );
}
