"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CalendarClock, Clock, FileText, ListChecks, Medal, Upload, Lightbulb, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NotFoundState, PageSkeleton } from "@/components/shared/states";
import { AssignmentStatusBadge, DifficultyBadge } from "@/components/shared/status-badge";
import { useAssignments, useSubmissions } from "@/hooks/use-data";
import { assignmentService } from "@/lib/services";
import { topicName } from "@/lib/mock-data/curriculum";
import { dueLabel, formatDate } from "@/lib/utils";

export default function AssignmentDetails() {
  const { id } = useParams<{ id: string }>();
  const assignments = useAssignments();
  const submissions = useSubmissions();
  if (!assignments || !submissions) return <PageSkeleton cards={3} />;
  const a = assignments.find((x) => x.id === id);
  if (!a) return <NotFoundState what="assignment" backHref="/student/homework" backLabel="Back to homework" />;
  const submission = submissions.find((s) => s.assignmentId === a.id);
  const done = a.live === "evaluated" || a.live === "submitted";

  const meta = [
    { icon: ListChecks, label: "Questions", value: a.questions.length },
    { icon: Medal, label: "Max marks", value: a.maxMarks },
    { icon: Clock, label: "Time", value: `~${a.estimatedMinutes} min` },
    { icon: CalendarClock, label: "Due", value: formatDate(a.dueDate, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/student/homework" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-500 hover:text-indigo">
        <ArrowLeft className="h-4 w-4" /> My Homework
      </Link>

      <div className="rounded-3xl border bg-card p-5 shadow-soft sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <AssignmentStatusBadge status={a.live} />
          <DifficultyBadge difficulty={a.difficulty} />
          <span className="text-sm font-semibold text-muted-foreground">Mathematics · {topicName(a.topicId)}</span>
        </div>
        <h1 className="mt-3 font-heading text-3xl font-bold">{a.title}</h1>
        <p className="mt-2 text-lg text-muted-foreground">{a.description}</p>
        {!done && <p className={`mt-2 text-sm font-bold ${a.live === "overdue" ? "text-coral-dark" : "text-indigo"}`}>{dueLabel(a.dueDate)}</p>}

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {meta.map((m) => (
            <div key={m.label} className="rounded-2xl bg-secondary/70 p-3">
              <m.icon className="h-5 w-5 text-indigo-400" />
              <p className="mt-2 font-heading text-lg font-bold leading-tight">{m.value}</p>
              <p className="text-xs font-medium text-muted-foreground">{m.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_1.6fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Lightbulb className="h-5 w-5 text-sun-dark" /> Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {(a.instructions.length ? a.instructions : ["Solve each question in your notebook and show your working."]).map((ins, i) => (
                <li key={i} className="flex gap-3 text-[15px]">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sun-light text-xs font-bold text-sun-dark">{i + 1}</span>
                  {ins}
                </li>
              ))}
            </ol>
            {a.referenceFileName && (
              <p className="mt-4 flex items-center gap-2 rounded-xl border bg-paper p-3 text-sm">
                <FileText className="h-4 w-4 text-indigo-400" /> Reference: {a.referenceFileName}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Questions</CardTitle>
            <p className="text-sm text-muted-foreground">Write your answers in your notebook, then take photos to submit.</p>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {a.questions.map((q) => (
                <li key={q.id} className="flex gap-3 rounded-2xl border p-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo font-heading text-sm font-bold text-white">{q.number}</span>
                  <div className="flex-1">
                    <p className="text-[15px] font-medium leading-relaxed">{q.text}</p>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">{q.marks} marks</p>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>

      <div className="sticky bottom-20 z-10 mt-6 lg:bottom-4">
        <div className="flex flex-col gap-2 rounded-2xl border bg-card/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <p className="px-2 text-sm text-muted-foreground">
            {done ? "You've already submitted this mission." : "Finished in your notebook? Upload photos for instant feedback."}
          </p>
          {done && submission ? (
            <Button asChild size="lg">
              <Link href={`/student/submissions/${submission.id}`}><Eye /> View results</Link>
            </Button>
          ) : (
            <Button asChild size="lg" variant="sun" onClick={() => assignmentService.markAssignmentStarted(a.id)}>
              <Link href={`/student/homework/${a.id}/submit`}><Upload /> {a.live === "overdue" ? "Submit late" : "Submit homework"}</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
