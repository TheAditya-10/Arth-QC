"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Images, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, PageSkeleton } from "@/components/shared/states";
import { EvaluationStatusBadge } from "@/components/shared/status-badge";
import { useWholeDB } from "@/hooks/use-data";
import { TOPICS, topicName } from "@/lib/mock-data/curriculum";
import { cn, formatDateTime, pct } from "@/lib/utils";
import type { EvaluationStatus } from "@/types";

export default function ParentSubmissions() {
  const db = useWholeDB();
  const [status, setStatus] = useState<"all" | EvaluationStatus>("all");
  const [topic, setTopic] = useState("all");

  const rows = useMemo(() => {
    if (!db) return [];
    return db.submissions
      .map((s) => ({
        s,
        a: db.assignments.find((x) => x.id === s.assignmentId),
        e: db.evaluations.find((x) => x.id === s.evaluationId),
      }))
      .filter((r) => status === "all" || r.s.status === status)
      .filter((r) => topic === "all" || r.a?.topicId === topic)
      .sort((x, y) => y.s.submittedAt.localeCompare(x.s.submittedAt));
  }, [db, status, topic]);

  if (!db) return <PageSkeleton />;

  return (
    <div>
      <PageHeader eyebrow="Homework" title="Submissions" description="Review AI evaluations, look at notebook pages and adjust marks if needed." />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="sm:w-52" aria-label="Filter by status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="needs_review">Needs review</SelectItem>
            <SelectItem value="evaluated">Evaluated</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="reviewed">Parent reviewed</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
          </SelectContent>
        </Select>
        <Select value={topic} onValueChange={setTopic}>
          <SelectTrigger className="sm:w-64" aria-label="Filter by topic"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All topics</SelectItem>
            {TOPICS.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Inbox} title="No submissions match" description="Change the filters to see more submissions." />
      ) : (
        <Card className="overflow-hidden">
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b bg-paper text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3 font-semibold">Submitted</th>
                  <th className="px-3 py-3 font-semibold">Assignment</th>
                  <th className="px-3 py-3 font-semibold">Pages</th>
                  <th className="px-3 py-3 font-semibold">Score</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3"><span className="sr-only">Action</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ s, a, e }) => {
                  const score = e ? e.parentOverride?.score ?? e.score : null;
                  const p = e && score !== null ? pct(score, e.maxScore) : null;
                  return (
                    <tr key={s.id} className="border-b last:border-0 hover:bg-paper">
                      <td className="px-5 py-3 text-muted-foreground">{formatDateTime(s.submittedAt)}</td>
                      <td className="px-3 py-3">
                        <p className="font-semibold">{a?.title ?? "Deleted assignment"}</p>
                        <p className="text-xs text-muted-foreground">{a ? topicName(a.topicId) : ""}</p>
                      </td>
                      <td className="px-3 py-3"><span className="inline-flex items-center gap-1"><Images className="h-4 w-4 text-indigo-300" /> {s.files.length}</span></td>
                      <td className="px-3 py-3">
                        {p !== null ? (
                          <span className="flex items-center gap-2">
                            <b>{score}/{e!.maxScore}</b>
                            <span className={cn("rounded px-1.5 text-xs font-bold", p >= 80 ? "bg-mint-light text-mint-dark" : p >= 60 ? "bg-sun-light text-sun-dark" : "bg-coral-light text-coral-dark")}>{p}%</span>
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-3 py-3"><EvaluationStatusBadge status={s.status} /></td>
                      <td className="px-5 py-3 text-right">
                        <Button asChild size="sm" variant={s.status === "needs_review" || s.status === "failed" ? "default" : "outline"}>
                          <Link href={`/parent/submissions/${s.id}`}>{s.status === "needs_review" || s.status === "evaluated" ? "Review" : "View"}</Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
