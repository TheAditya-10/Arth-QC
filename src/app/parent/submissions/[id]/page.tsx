"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCheck, ExternalLink, FileText, History, Loader2, Maximize2, Pencil, RefreshCw, Save, ShieldCheck, StickyNote, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { NotFoundState, PageSkeleton } from "@/components/shared/states";
import { EvaluationStatusBadge } from "@/components/shared/status-badge";
import { QuestionResultCard } from "@/components/evaluation/question-result-card";
import { useWholeDB } from "@/hooks/use-data";
import { submissionService } from "@/lib/client";
import { topicName } from "@/lib/mock-data/curriculum";
import { formatDateTime, pct } from "@/lib/utils";
import { errorMessage } from "@/lib/client/api";

export default function ParentSubmissionDetail() {
  const { id } = useParams<{ id: string }>();
  const db = useWholeDB();
  const [editing, setEditing] = useState(false);
  const [marks, setMarks] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<number | null>(null);

  const sub = db?.submissions.find((s) => s.id === id);
  const e = db?.evaluations.find((x) => x.id === sub?.evaluationId);

  useEffect(() => {
    if (e && !editing) {
      setMarks(Object.fromEntries(e.results.map((r) => [r.questionId, r.marksAwarded])));
      setNote("");
    }
  }, [e, editing]);

  if (!db) return <PageSkeleton cards={3} />;
  if (!sub) return <NotFoundState what="submission" backHref="/parent/submissions" backLabel="Back to submissions" />;
  const a = db.assignments.find((x) => x.id === sub.assignmentId);
  const score = e ? e.parentOverride?.score ?? e.score : 0;
  const draftTotal = Object.values(marks).reduce((s, m) => s + (Number(m) || 0), 0);

  const save = async () => {
    if (!e) return;
    const invalid = e.results.find((r) => marks[r.questionId] < 0 || marks[r.questionId] > r.maxMarks || Number.isNaN(marks[r.questionId]));
    if (invalid) {
      toast.error(`Q${invalid.number}: marks must be between 0 and ${invalid.maxMarks}`);
      return;
    }
    if (note.trim().length < 3) {
      toast.error("Please add a short reason for the correction.");
      return;
    }
    const corrections = e.results
      .filter((r) => r.questionEvaluationId && Math.abs((marks[r.questionId] ?? r.marksAwarded) - r.marksAwarded) > 0.001)
      .map((r) => ({ questionEvaluationId: r.questionEvaluationId!, newMarks: marks[r.questionId] }));
    setSaving(true);
    try {
      await submissionService.correctEvaluation(sub.id, corrections, note.trim());
      toast.success(corrections.length ? "Evaluation corrected" : "Evaluation approved", { description: "The original AI marks are kept in the audit trail." });
      setEditing(false);
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't save changes"));
    } finally {
      setSaving(false);
    }
  };

  const approve = async () => {
    setSaving(true);
    try {
      await submissionService.correctEvaluation(sub.id, [], "Reviewed by parent — marks confirmed");
      toast.success("Marked as reviewed");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const retry = async (newVersion: boolean) => {
    setSaving(true);
    try {
      await submissionService.retryEvaluation(sub.id, newVersion);
      toast.success(newVersion ? "Re-evaluation started" : "Evaluation restarted", { description: "This usually takes under a minute." });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const file = preview !== null ? sub.files[preview] : null;

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/parent/submissions" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-500 hover:text-indigo">
        <ArrowLeft className="h-4 w-4" /> Submissions
      </Link>

      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <EvaluationStatusBadge status={sub.status} />
          <h1 className="mt-2 font-heading text-3xl font-bold">{a?.title ?? "Submission"}</h1>
          <p className="text-muted-foreground">{a && topicName(a.topicId)} · Submitted {formatDateTime(sub.submittedAt)}</p>
        </div>
        {e && (
          <div className="flex items-center gap-4 rounded-2xl border bg-card px-5 py-3">
            <div>
              <p className="text-xs text-muted-foreground">Score</p>
              <p className="font-heading text-2xl font-bold">{editing ? draftTotal : score}/{e.maxScore}</p>
            </div>
            <div className="h-10 w-px bg-border" />
            <div>
              <p className="text-xs text-muted-foreground">Percentage</p>
              <p className="font-heading text-2xl font-bold">{pct(editing ? draftTotal : score, e.maxScore)}%</p>
            </div>
            {e.parentOverride && !editing && (
              <span className="hidden text-xs text-muted-foreground sm:block">Original AI score: {e.parentOverride.originalScore}/{e.maxScore}</span>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader><CardTitle className="text-base">Notebook pages ({sub.files.length})</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              {sub.files.map((f, i) => (
                <button key={f.id} type="button" onClick={() => setPreview(i)} className="group relative overflow-hidden rounded-xl border bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Open page ${i + 1}`}>
                  {f.kind === "image" && f.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.previewUrl} alt={`Notebook page ${i + 1}`} className="aspect-[3/4] w-full object-cover transition group-hover:scale-105" />
                  ) : (
                    <div className="flex aspect-[3/4] flex-col items-center justify-center gap-1 text-coral-dark"><FileText className="h-8 w-8" /><span className="text-xs font-bold">{f.kind === "pdf" ? "PDF" : "No preview"}</span></div>
                  )}
                  <span className="absolute bottom-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 opacity-0 shadow transition group-hover:opacity-100"><Maximize2 className="h-3.5 w-3.5" /></span>
                </button>
              ))}
            </CardContent>
          </Card>
          {sub.notes && (
            <Card>
              <CardContent className="flex gap-3 p-4 text-sm">
                <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-sun-dark" />
                <div><p className="font-semibold">Note from {db.student.name}</p><p className="text-muted-foreground">{sub.notes}</p></div>
              </CardContent>
            </Card>
          )}
          {e && (
            <Card>
              <CardHeader><CardTitle className="text-base">AI summary</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p>{e.summary}</p>
                {e.needsAttention.length > 0 && (
                  <div>
                    <p className="mb-1 font-semibold">Needs attention</p>
                    <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">{e.needsAttention.map((n) => <li key={n}>{n}</li>)}</ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          {sub.status === "failed" ? (
            <Card className="border-coral/50 p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-coral-dark" />
                <div className="flex-1 text-sm">
                  <p className="font-semibold">Automatic evaluation failed</p>
                  <p className="text-muted-foreground">{sub.jobError ?? "The AI service couldn't process this submission."}</p>
                </div>
                <Button size="sm" onClick={() => retry(false)} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <RefreshCw />} Retry</Button>
              </div>
            </Card>
          ) : !e ? (
            <Card className="flex items-center gap-3 p-6"><Loader2 className="h-5 w-5 animate-spin" /> Evaluation in progress… {sub.jobError && <span className="text-xs text-muted-foreground">(retrying: {sub.jobError})</span>}</Card>
          ) : (
            <>
              {e.needsReview && e.reviewReasons && e.reviewReasons.length > 0 && (
                <Card className="border-sun bg-sun-light/40">
                  <CardContent className="p-4 text-sm">
                    <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4 text-sun-dark" /> Please review — the AI flagged this evaluation</p>
                    <ul className="mt-2 list-disc space-y-0.5 pl-5">{e.reviewReasons.map((r) => <li key={r}>{r}</li>)}</ul>
                  </CardContent>
                </Card>
              )}
              <Card className="border-indigo-200">
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-5 w-5 text-indigo" />
                    <div className="text-sm">
                      <p className="font-semibold">{e.parentOverride ? "You reviewed this evaluation" : "Review the AI evaluation"}</p>
                      <p className="text-muted-foreground">
                        {e.parentOverride ? `Last updated ${formatDateTime(e.parentOverride.at)}` : "Check the marks against the notebook pages and correct them if needed."}
                      </p>
                    </div>
                  </div>
                  {!editing && (
                    <div className="flex flex-wrap gap-2">
                      {e.needsReview && <Button variant="outline" onClick={approve} disabled={saving}><CheckCheck /> Marks look right</Button>}
                      <Button onClick={() => setEditing(true)}><Pencil /> Correct marks</Button>
                      <Button variant="ghost" size="icon" onClick={() => retry(true)} disabled={saving} aria-label="Re-evaluate with AI" title="Re-evaluate with AI"><RefreshCw /></Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {editing && (
                <Card className="border-sun bg-sun-light/30">
                  <CardContent className="space-y-3 p-4">
                    <Label htmlFor="note">Reason for the correction (shown to {db.student.name})</Label>
                    <Textarea id="note" value={note} onChange={(ev) => setNote(ev.target.value.slice(0, 500))} placeholder="e.g. Q3: the handwriting says 18,000 — the AI misread it." />
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button variant="ghost" onClick={() => setEditing(false)} disabled={saving}><X /> Cancel</Button>
                      <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Save />} Save review ({draftTotal}/{e.maxScore})</Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {e.corrections && e.corrections.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4" /> Correction history</CardTitle></CardHeader>
                  <CardContent className="space-y-1.5 text-sm">
                    {e.corrections.map((c, i) => (
                      <p key={i} className="rounded-lg bg-secondary/60 px-3 py-2">
                        <b>Q{c.questionNumber}</b>: {c.previousMarks} → {c.newMarks} · {c.by} · {formatDateTime(c.at)}
                        <span className="block text-muted-foreground">“{c.reason}”</span>
                      </p>
                    ))}
                    {e.model && <p className="pt-1 text-xs text-muted-foreground">Evaluated by {e.model} · prompts {e.promptVersion}</p>}
                  </CardContent>
                </Card>
              )}

              {e.results.map((r) => (
                <QuestionResultCard
                  key={`${r.questionId}-${editing}`}
                  r={r}
                  defaultOpen={editing}
                  footer={
                    editing ? (
                      <div className="flex items-center gap-3 rounded-xl border border-sun bg-sun-light/40 p-3">
                        <Label htmlFor={`m-${r.questionId}`} className="flex-1">Marks for Q{r.number}</Label>
                        <Input
                          id={`m-${r.questionId}`}
                          type="number"
                          min={0}
                          max={r.maxMarks}
                          value={marks[r.questionId] ?? 0}
                          onChange={(ev) => setMarks((m) => ({ ...m, [r.questionId]: Number(ev.target.value) }))}
                          className="w-20"
                        />
                        <span className="text-sm text-muted-foreground">/ {r.maxMarks}</span>
                      </div>
                    ) : undefined
                  }
                />
              ))}
            </>
          )}
        </div>
      </div>

      <Dialog open={preview !== null} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-2xl p-3">
          <DialogTitle className="px-2 pt-1 text-base">Page {preview !== null ? preview + 1 : ""} · {file?.name}</DialogTitle>
          {file?.kind === "pdf" && file.previewUrl ? (
            <Button asChild variant="outline"><a href={file.previewUrl} target="_blank" rel="noreferrer"><ExternalLink /> Open PDF</a></Button>
          ) : file?.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={file.previewUrl} alt={file.name} className="max-h-[75vh] w-full rounded-xl object-contain" />
          ) : (
            <div className="flex h-60 flex-col items-center justify-center gap-2 rounded-xl bg-paper text-muted-foreground"><FileText className="h-10 w-10" /> Preview not available for this file</div>
          )}
          <div className="flex justify-between px-1">
            <Button variant="outline" size="sm" disabled={!preview} onClick={() => setPreview((p) => (p ? p - 1 : p))}>Previous</Button>
            <Button variant="outline" size="sm" disabled={preview === null || preview >= sub.files.length - 1} onClick={() => setPreview((p) => (p !== null ? p + 1 : p))}>Next</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
