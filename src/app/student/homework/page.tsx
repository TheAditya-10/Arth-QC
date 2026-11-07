"use client";

import { useMemo, useState } from "react";
import { AlertCircle, BookOpenCheck, CheckCircle2, Clock } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, PageSkeleton } from "@/components/shared/states";
import { AssignmentCard } from "@/components/homework/assignment-card";
import { useAssignments, useSubmissions } from "@/hooks/use-data";
import { cn } from "@/lib/utils";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "submitted", label: "Submitted" },
  { key: "evaluated", label: "Evaluated" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

export default function HomeworkPage() {
  const assignments = useAssignments();
  const submissions = useSubmissions();
  const [filter, setFilter] = useState<FilterKey>("all");

  const groups = useMemo(() => {
    if (!assignments) return null;
    const sorted = [...assignments].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const matches = (live: string) =>
      filter === "all" ||
      (filter === "pending" && ["pending", "in_progress", "overdue"].includes(live)) ||
      (filter === "submitted" && live === "submitted") ||
      (filter === "evaluated" && live === "evaluated");
    const list = sorted.filter((a) => matches(a.live));
    return {
      overdue: list.filter((a) => a.live === "overdue"),
      pending: list.filter((a) => a.live === "pending" || a.live === "in_progress"),
      submitted: list.filter((a) => a.live === "submitted"),
      done: list.filter((a) => a.live === "evaluated").reverse(),
      counts: {
        all: assignments.length,
        pending: assignments.filter((a) => ["pending", "in_progress", "overdue"].includes(a.live)).length,
        submitted: assignments.filter((a) => a.live === "submitted").length,
        evaluated: assignments.filter((a) => a.live === "evaluated").length,
      },
      total: list.length,
    };
  }, [assignments, filter]);

  if (!groups || !submissions) return <PageSkeleton />;

  const hrefFor = (id: string, live: string) => {
    if (live === "evaluated" || live === "submitted") {
      const sub = submissions.find((s) => s.assignmentId === id);
      if (sub) return `/student/submissions/${sub.id}`;
    }
    return `/student/homework/${id}`;
  };

  const section = (title: string, icon: React.ReactNode, items: typeof groups.pending) =>
    items.length > 0 && (
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
          {icon} {title} <span className="text-sm font-medium text-muted-foreground">({items.length})</span>
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((a, i) => (
            <AssignmentCard key={a.id} a={a} href={hrefFor(a.id, a.live)} index={i} />
          ))}
        </div>
      </section>
    );

  return (
    <div>
      <PageHeader title="My Homework" description="Your missions from Mumma & Papa. Finish them to earn XP!" />

      <div className="scrollbar-none -mx-4 mb-6 flex gap-2 overflow-x-auto px-4" role="tablist" aria-label="Filter homework">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            role="tab"
            aria-selected={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition",
              filter === f.key ? "border-indigo bg-indigo text-white" : "bg-card text-indigo-500 hover:bg-secondary",
            )}
          >
            {f.label}
            <span className={cn("rounded-full px-1.5 text-xs", filter === f.key ? "bg-white/20" : "bg-secondary")}>{groups.counts[f.key]}</span>
          </button>
        ))}
      </div>

      {groups.total === 0 ? (
        <EmptyState
          icon={BookOpenCheck}
          title={filter === "submitted" ? "Nothing waiting for evaluation" : "No homework here"}
          description={filter === "submitted" ? "Submitted homework appears here while Arth-QC checks it." : "Try another filter to see your other missions."}
        />
      ) : (
        <div className="space-y-8">
          {section("Overdue", <AlertCircle className="h-5 w-5 text-coral-dark" />, groups.overdue)}
          {section("To do", <Clock className="h-5 w-5 text-indigo" />, groups.pending)}
          {section("Submitted", <Clock className="h-5 w-5 text-indigo-400" />, groups.submitted)}
          {section("Completed", <CheckCircle2 className="h-5 w-5 text-mint-dark" />, groups.done)}
        </div>
      )}
    </div>
  );
}
