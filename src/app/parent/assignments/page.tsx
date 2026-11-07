"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ClipboardList, Eye, MoreHorizontal, Pencil, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, PageSkeleton } from "@/components/shared/states";
import { AssignmentStatusBadge, DifficultyBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useAssignments } from "@/hooks/use-data";
import { assignmentService } from "@/lib/client";
import { topicName } from "@/lib/mock-data/curriculum";
import { cn, dueLabel, formatDate } from "@/lib/utils";

const FILTERS = ["all", "open", "overdue", "submitted", "evaluated"] as const;

export default function ParentAssignments() {
  const assignments = useAssignments();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [q, setQ] = useState("");
  const [toDelete, setToDelete] = useState<string | null>(null);

  const list = useMemo(() => {
    if (!assignments) return [];
    return [...assignments]
      .filter((a) => {
        if (filter === "open") return a.live === "pending" || a.live === "in_progress";
        if (filter === "overdue") return a.live === "overdue";
        if (filter === "submitted") return a.live === "submitted";
        if (filter === "evaluated") return a.live === "evaluated";
        return true;
      })
      .filter((a) => !q || `${a.title} ${topicName(a.topicId)}`.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => b.dueDate.localeCompare(a.dueDate));
  }, [assignments, filter, q]);

  if (!assignments) return <PageSkeleton />;
  const target = assignments.find((a) => a.id === toDelete);

  return (
    <div>
      <PageHeader
        eyebrow="Homework"
        title="Assignments"
        description="Create, edit and track homework for your child."
        actions={<Button asChild><Link href="/parent/assignments/new"><Plus /> New assignment</Link></Button>}
      />

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="scrollbar-none flex min-w-0 max-w-full gap-1 overflow-x-auto rounded-xl bg-secondary p-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn("shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold capitalize transition", filter === f ? "bg-card text-indigo shadow-sm" : "text-indigo-400 hover:text-indigo")}
              aria-pressed={filter === f}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="relative md:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search assignments" className="pl-9" aria-label="Search assignments" />
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No assignments found"
          description={q ? "Try a different search term." : "Create an assignment to get started."}
          action={<Button asChild><Link href="/parent/assignments/new"><Plus /> New assignment</Link></Button>}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b bg-paper text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3 font-semibold">Assignment</th>
                  <th className="px-3 py-3 font-semibold">Difficulty</th>
                  <th className="px-3 py-3 font-semibold">Questions</th>
                  <th className="px-3 py-3 font-semibold">Due</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {list.map((a) => (
                  <tr key={a.id} className="border-b last:border-0 hover:bg-paper">
                    <td className="px-5 py-3">
                      <Link href={`/parent/assignments/${a.id}`} className="font-semibold hover:underline">{a.title}</Link>
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {topicName(a.topicId)} · Class {a.grade}
                        {a.source === "ai" && <span className="inline-flex items-center gap-0.5 rounded bg-lavender px-1 font-semibold text-indigo"><Sparkles className="h-3 w-3" /> AI</span>}
                      </p>
                    </td>
                    <td className="px-3 py-3"><DifficultyBadge difficulty={a.difficulty} /></td>
                    <td className="px-3 py-3">{a.questions.length} · {a.maxMarks} marks</td>
                    <td className="px-3 py-3">
                      <p>{formatDate(a.dueDate)}</p>
                      {a.live !== "evaluated" && a.live !== "submitted" && <p className={cn("text-xs", a.live === "overdue" ? "text-coral-dark" : "text-muted-foreground")}>{dueLabel(a.dueDate)}</p>}
                    </td>
                    <td className="px-3 py-3"><AssignmentStatusBadge status={a.live} /></td>
                    <td className="px-5 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Actions for ${a.title}`}><MoreHorizontal /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild><Link href={`/parent/assignments/${a.id}`}><Eye /> View</Link></DropdownMenuItem>
                          <DropdownMenuItem asChild><Link href={`/parent/assignments/${a.id}/edit`}><Pencil /> Edit</Link></DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setToDelete(a.id)} className="text-destructive focus:text-destructive"><Trash2 /> Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete this assignment?"
        description={target ? `"${target.title}" will be removed from the student's homework. Existing submissions are kept.` : undefined}
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!toDelete) return;
          await assignmentService.deleteAssignment(toDelete);
          toast.success("Assignment deleted");
          setToDelete(null);
        }}
      />
    </div>
  );
}
