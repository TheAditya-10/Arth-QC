"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, CloudUpload, Loader2, Send, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NotFoundState, PageSkeleton } from "@/components/shared/states";
import { FileDropzone } from "@/components/homework/file-dropzone";
import { ProcessingScreen } from "@/components/evaluation/processing-screen";
import { useAssignments } from "@/hooks/use-data";
import { submissionService } from "@/lib/client";
import type { LocalFile } from "@/lib/client/submission.service";
import { errorMessage, idempotencyKey } from "@/lib/client/api";
import { topicName } from "@/lib/mock-data/curriculum";

type Phase = "select" | "uploading" | "processing" | "error";

export default function SubmitHomework() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const assignments = useAssignments();
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [notes, setNotes] = useState("");
  const [phase, setPhase] = useState<Phase>("select");
  const [uploadPct, setUploadPct] = useState(0);
  const [stage, setStage] = useState(0);
  const [retrying, setRetrying] = useState(false);
  // Same key for retries of this submit, so a network retry never creates a duplicate.
  const submitKey = useRef(idempotencyKey());
  const uploaded = useRef<{ sig: string; ids: string[] } | null>(null);

  if (!assignments) return <PageSkeleton cards={2} />;
  const a = assignments.find((x) => x.id === id);
  if (!a) return <NotFoundState what="assignment" backHref="/student/homework" backLabel="Back to homework" />;
  const done = (a.live === "evaluated" || a.live === "submitted") && phase === "select";

  const submit = async () => {
    if (!files.length) {
      toast.error("Add at least one photo or PDF of your work.");
      return;
    }
    try {
      setPhase("uploading");
      // Re-use already uploaded files if the student retries after an error.
      const sig = files.map((f) => f.id).join(",");
      const ids = uploaded.current?.sig === sig ? uploaded.current.ids : await submissionService.uploadFiles(files, setUploadPct);
      uploaded.current = { sig, ids };
      const sub = await submissionService.createSubmission({ assignmentId: a.id, uploadIds: ids, notes: notes.trim() || undefined, key: submitKey.current });
      setPhase("processing");
      const status = await submissionService.evaluateSubmission(sub.submissionId, setStage, { onStatus: (s) => setRetrying(s.retrying) });
      if (status.status === "FAILED") {
        toast.error("We couldn't check this automatically", { description: "Your work is saved — a parent will review it." });
      } else if (status.done) {
        toast.success("Your homework has been checked!", { description: "Let's see how you did." });
      } else {
        toast("Still checking…", { description: "This is taking longer than usual. Your results will appear soon." });
      }
      router.replace(`/student/submissions/${sub.submissionId}`);
    } catch (e) {
      setPhase("error");
      toast.error("Submission failed", { description: errorMessage(e, "Please try again.") });
    }
  };

  if (phase === "processing") return <ProcessingScreen stage={stage} title={retrying ? `${a.title} — busy right now, retrying automatically…` : a.title} />;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/student/homework/${a.id}`} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-500 hover:text-indigo">
        <ArrowLeft className="h-4 w-4" /> Back to mission
      </Link>
      <h1 className="font-heading text-2xl font-bold sm:text-3xl">Submit your homework</h1>
      <p className="mt-1 text-muted-foreground">
        {a.title} · {a.questions.length} questions · {a.maxMarks} marks
      </p>

      {done ? (
        <Card className="mt-6 p-6 text-center">
          <p className="font-semibold">This mission is already submitted.</p>
          <Button asChild className="mt-3"><Link href="/student/homework">Back to homework</Link></Button>
        </Card>
      ) : (
        <div className="mt-6 space-y-5">
          <FileDropzone files={files} onChange={setFiles} disabled={phase === "uploading"} />
          <Card>
            <CardContent className="grid gap-5 p-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Topic</Label>
                <p className="flex items-center gap-2 rounded-xl border bg-paper px-3 py-2.5 text-sm font-medium">
                  <BookOpen className="h-4 w-4 text-indigo-400" /> {topicName(a.topicId)}
                </p>
                <p className="text-xs text-muted-foreground">Set by your parent for this assignment.</p>
              </div>
              <div className="space-y-2 sm:row-span-2">
                <Label htmlFor="notes">Notes for Mumma & Papa <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value.slice(0, 300))}
                  placeholder="e.g. Q4 was tricky, I tried two methods."
                  className="min-h-[110px]"
                  disabled={phase === "uploading"}
                />
                <p className="text-right text-xs text-muted-foreground">{notes.length}/300</p>
              </div>
            </CardContent>
          </Card>

          <AnimatePresence>
            {phase === "uploading" && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-2xl border bg-card p-4" role="status" aria-live="polite">
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span className="flex items-center gap-2"><CloudUpload className="h-4 w-4" /> Uploading {files.length} file{files.length > 1 ? "s" : ""}…</span>
                  <span>{uploadPct}%</span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted">
                  <motion.div className="h-full rounded-full bg-mint-dark" animate={{ width: `${uploadPct}%` }} transition={{ duration: 0.2 }} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="sticky bottom-20 z-10 flex flex-col-reverse gap-2 rounded-2xl border bg-card/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between lg:bottom-4">
            <p className="px-2 text-sm text-muted-foreground">{files.length ? `${files.length} file${files.length > 1 ? "s" : ""} ready` : "No files added yet"}</p>
            <Button size="lg" variant="sun" onClick={submit} disabled={phase === "uploading" || files.length === 0}>
              {phase === "uploading" ? <Loader2 className="animate-spin" /> : <Send />}
              {phase === "uploading" ? "Uploading…" : phase === "error" ? "Try again" : "Submit homework"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
