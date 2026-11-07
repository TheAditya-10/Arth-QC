"use client";

import Link from "next/link";
import { ChevronRight, Inbox } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, PageSkeleton } from "@/components/shared/states";
import { EvaluationStatusBadge } from "@/components/shared/status-badge";
import { useAssignmentsRaw, useEvaluations, useSubmissions } from "@/hooks/use-data";
import { formatDate, pct } from "@/lib/utils";

export default function StudentSubmissions() {
  const subs = useSubmissions();
  const evals = useEvaluations();
  const assignments = useAssignmentsRaw();
  if (!subs || !evals || !assignments) return <PageSkeleton />;
  return (
    <div>
      <PageHeader title="My results" description="Every homework you've submitted, with feedback." />
      {subs.length === 0 ? (
        <EmptyState icon={Inbox} title="No submissions yet" description="Finish a homework mission to see your results here." />
      ) : (
        <ul className="space-y-2">
          {subs.map((s) => {
            const a = assignments.find((x) => x.id === s.assignmentId);
            const e = evals.find((x) => x.id === s.evaluationId);
            return (
              <li key={s.id}>
                <Link href={`/student/submissions/${s.id}`} className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-soft transition hover:bg-secondary/40">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-lavender font-heading font-bold">{e ? `${pct(e.parentOverride?.score ?? e.score, e.maxScore)}%` : "…"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{a?.title ?? "Homework"}</p>
                    <p className="text-xs text-muted-foreground">Submitted {formatDate(s.submittedAt)}</p>
                  </div>
                  <EvaluationStatusBadge status={s.status} />
                  <ChevronRight className="h-4 w-4 text-indigo-300" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
