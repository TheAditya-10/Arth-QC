"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, FileText, Inbox, Pencil, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NotFoundState, PageSkeleton } from "@/components/shared/states";
import { AssignmentStatusBadge, DifficultyBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useAssignments, useSubmissions } from "@/hooks/use-data";
import { assignmentService } from "@/lib/services";
import { subjectName, topicName } from "@/lib/mock-data/curriculum";
import { formatDateTime } from "@/lib/utils";

export default function ParentAssignmentView() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const assignments = useAssignments();
  const submissions = useSubmissions();
  const [confirm, setConfirm] = useState(false);
  if (!assignments || !submissions) return <PageSkeleton cards={3} />;
  const a = assignments.find((x) => x.id === id);
  if (!a) return <NotFoundState what="assignment" backHref="/parent/assignments" backLabel="Back to assignments" />;
  const subs = submissions.filter((s) => s.assignmentId === a.id);

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/parent/assignments" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-500 hover:text-indigo">
        <ArrowLeft className="h-4 w-4" /> Assignments
      </Link>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <AssignmentStatusBadge status={a.live} />
            <DifficultyBadge difficulty={a.difficulty} />
            {a.source === "ai" && <span className="inline-flex items-center gap-1 rounded-full bg-lavender px-2 py-0.5 text-xs font-semibold"><Sparkles className="h-3 w-3" /> AI generated</span>}
          </div>
          <h1 className="mt-2 font-heading text-3xl font-bold">{a.title}</h1>
          <p className="mt-1 text-muted-foreground">{a.description}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button asChild variant="outline"><Link href={`/parent/assignments/${a.id}/edit`}><Pencil /> Edit</Link></Button>
          <Button variant="outline" className="text-destructive" onClick={() => setConfirm(true)}><Trash2 /> Delete</Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Questions ({a.questions.length})</CardTitle></CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {a.questions.map((q) => (
                  <li key={q.id} className="rounded-xl border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium"><span className="mr-2 font-heading font-bold text-indigo-400">Q{q.number}.</span>{q.text}</p>
                      <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs font-bold">{q.marks} marks</span>
                    </div>
                    <p className="mt-2 rounded-lg bg-mint-light/60 px-3 py-2 text-sm"><b className="text-mint-dark">Expected:</b> {q.expectedAnswer}</p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
          {a.markingScheme && (
            <Card>
              <CardHeader><CardTitle>Marking scheme</CardTitle></CardHeader>
              <CardContent><p className="text-sm">{a.markingScheme}</p></CardContent>
            </Card>
          )}
        </div>
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-2.5 p-5 text-sm">
              {[
                ["Subject", subjectName(a.subjectId)],
                ["Topic", topicName(a.topicId)],
                ["Class", a.grade],
                ["Maximum marks", a.maxMarks],
                ["Estimated time", `${a.estimatedMinutes} min`],
                ["Due", formatDateTime(a.dueDate)],
                ["Created", formatDateTime(a.createdAt)],
              ].map(([k, v]) => (
                <div key={String(k)} className="flex justify-between gap-3"><span className="text-muted-foreground">{k}</span><span className="text-right font-medium">{v}</span></div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Instructions</CardTitle></CardHeader>
            <CardContent>
              <ul className="list-disc space-y-1 pl-5 text-sm">{a.instructions.map((i) => <li key={i}>{i}</li>)}</ul>
              {a.referenceFileName && <p className="mt-3 flex items-center gap-2 text-sm"><FileText className="h-4 w-4 text-indigo-400" /> {a.referenceFileName}</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Submissions</CardTitle></CardHeader>
            <CardContent>
              {subs.length ? subs.map((s) => (
                <Button key={s.id} asChild variant="secondary" className="w-full justify-start"><Link href={`/parent/submissions/${s.id}`}><Inbox /> View submission · {formatDateTime(s.submittedAt)}</Link></Button>
              )) : <p className="text-sm text-muted-foreground">Not submitted yet.</p>}
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Delete this assignment?"
        description={`"${a.title}" will be removed from the student's homework.`}
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          await assignmentService.deleteAssignment(a.id);
          toast.success("Assignment deleted");
          router.push("/parent/assignments");
        }}
      />
    </div>
  );
}
