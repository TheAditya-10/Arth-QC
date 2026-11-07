"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { FileUp, GripVertical, Loader2, PenLine, Plus, Save, Sparkles, Trash2, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { assignmentSchema, type AssignmentFormInput, type AssignmentFormValues } from "@/lib/validations/assignment";
import { assignmentService } from "@/lib/services";
import { SUBJECTS, TOPICS } from "@/lib/mock-data/curriculum";
import type { Assignment, Difficulty } from "@/types";
import { cn } from "@/lib/utils";

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaults(a?: Assignment): AssignmentFormInput {
  const due = new Date();
  due.setDate(due.getDate() + 3);
  due.setHours(18, 0, 0, 0);
  return {
    title: a?.title ?? "",
    subjectId: a?.subjectId ?? "mathematics",
    topicId: a?.topicId ?? "",
    grade: a?.grade ?? 6,
    description: a?.description ?? "",
    instructions: a?.instructions.join("\n") ?? "Show all your working.\nWrite neatly and number each answer.",
    questions: a?.questions.map((q) => ({ text: q.text, marks: q.marks, expectedAnswer: q.expectedAnswer })) ?? [{ text: "", marks: 5, expectedAnswer: "" }],
    difficulty: a?.difficulty ?? "medium",
    estimatedMinutes: a?.estimatedMinutes ?? 30,
    dueDate: toLocalInput(a?.dueDate ?? due.toISOString()),
    markingScheme: a?.markingScheme ?? "",
    referenceFileName: a?.referenceFileName ?? "",
    source: a?.source ?? "manual",
  };
}

function FieldError({ msg }: { msg?: string }) {
  return msg ? <p className="text-xs font-medium text-destructive" role="alert">{msg}</p> : null;
}

export function AssignmentForm({ existing }: { existing?: Assignment }) {
  const router = useRouter();
  const [mode, setMode] = useState<"manual" | "ai">(existing?.source ?? "manual");
  const [ai, setAi] = useState<{ topicId: string; difficulty: Difficulty; count: number; marksEach: number }>({ topicId: "fractions", difficulty: "medium", count: 5, marksEach: 4 });
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(Boolean(existing));

  const form = useForm<AssignmentFormInput, unknown, AssignmentFormValues>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: defaults(existing),
  });
  const { register, control, handleSubmit, formState, watch, setValue, reset } = form;
  const { errors, isSubmitting } = formState;
  const { fields, append, remove } = useFieldArray({ control, name: "questions" });
  const questions = watch("questions");
  const total = questions.reduce((s, q) => s + (Number(q.marks) || 0), 0);
  const refName = watch("referenceFileName");

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await assignmentService.generateAIQuestions(ai);
      reset({
        ...form.getValues(),
        title: res.title,
        description: res.description,
        topicId: ai.topicId,
        difficulty: ai.difficulty,
        questions: res.questions,
        estimatedMinutes: Math.max(10, res.questions.length * 5),
        source: "ai",
      });
      setGenerated(true);
      toast.success(`Generated ${res.questions.length} questions`, { description: "Review and edit them before saving." });
    } catch {
      toast.error("Generation failed. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const onSubmit = async (values: AssignmentFormValues) => {
    try {
      if (existing) {
        await assignmentService.updateAssignment(existing.id, values);
        toast.success("Assignment updated");
        router.push(`/parent/assignments/${existing.id}`);
      } else {
        const a = await assignmentService.createAssignment(values);
        toast.success("Assignment created", { description: "It's now visible in the student's homework." });
        router.push(`/parent/assignments/${a.id}`);
      }
    } catch (e) {
      toast.error("Couldn't save", { description: e instanceof Error ? e.message : undefined });
    }
  };

  const showForm = mode === "manual" || generated;

  return (
    <form onSubmit={handleSubmit(onSubmit, () => toast.error("Please fix the highlighted fields."))} className="space-y-6" noValidate>
      {!existing && (
        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Creation method">
          {([
            { k: "manual", icon: PenLine, t: "Manual assignment", d: "Type your own questions and answers." },
            { k: "ai", icon: Wand2, t: "AI assignment", d: "Pick a topic and let Arth-QC draft questions (demo)." },
          ] as const).map((o) => (
            <button
              key={o.k}
              type="button"
              role="radio"
              aria-checked={mode === o.k}
              onClick={() => {
                setMode(o.k);
                setValue("source", o.k);
              }}
              className={cn("flex items-start gap-3 rounded-2xl border-2 bg-card p-4 text-left transition", mode === o.k ? "border-indigo shadow-soft" : "border-transparent hover:border-indigo-100")}
            >
              <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", mode === o.k ? "bg-indigo text-white" : "bg-secondary text-indigo")}><o.icon className="h-5 w-5" /></span>
              <span>
                <span className="block font-semibold">{o.t}</span>
                <span className="text-sm text-muted-foreground">{o.d}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      <AnimatePresence>
        {mode === "ai" && !existing && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <Card className="border-indigo-200 bg-lavender/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-sun-dark" /> Generate with AI</CardTitle>
                <p className="text-sm text-muted-foreground">Simulated in this demo — questions come from the built-in NCERT question bank.</p>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <div className="space-y-2 lg:col-span-2">
                  <Label htmlFor="ai-topic">Topic</Label>
                  <Select value={ai.topicId} onValueChange={(v) => setAi({ ...ai, topicId: v })}>
                    <SelectTrigger id="ai-topic"><SelectValue /></SelectTrigger>
                    <SelectContent>{TOPICS.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ai-diff">Difficulty</Label>
                  <Select value={ai.difficulty} onValueChange={(v) => setAi({ ...ai, difficulty: v as Difficulty })}>
                    <SelectTrigger id="ai-diff"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ai-count">Questions</Label>
                  <Select value={String(ai.count)} onValueChange={(v) => setAi({ ...ai, count: Number(v) })}>
                    <SelectTrigger id="ai-count"><SelectValue /></SelectTrigger>
                    <SelectContent>{[3, 4, 5, 6, 8, 9].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ai-marks">Marks each</Label>
                  <Select value={String(ai.marksEach)} onValueChange={(v) => setAi({ ...ai, marksEach: Number(v) })}>
                    <SelectTrigger id="ai-marks"><SelectValue /></SelectTrigger>
                    <SelectContent>{[2, 4, 5, 10].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2 lg:col-span-5">
                  <Button type="button" onClick={generate} disabled={generating}>
                    {generating ? <Loader2 className="animate-spin" /> : <Wand2 />}
                    {generating ? "Generating questions…" : generated ? "Regenerate" : "Generate questions"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {showForm && (
        <>
          <Card>
            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="title">Assignment title</Label>
                <Input id="title" placeholder="e.g. Equivalent Fractions Mission" aria-invalid={!!errors.title} {...register("title")} />
                <FieldError msg={errors.title?.message} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Controller
                  control={control}
                  name="subjectId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="subject"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SUBJECTS.map((s) => <SelectItem key={s.id} value={s.id} disabled={!s.enabled}>{s.name}{!s.enabled && " (coming soon)"}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="topic">Topic</Label>
                <Controller
                  control={control}
                  name="topicId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="topic" aria-invalid={!!errors.topicId}><SelectValue placeholder="Choose a chapter" /></SelectTrigger>
                      <SelectContent>{TOPICS.map((t) => <SelectItem key={t.id} value={t.id}>Ch {t.chapter} · {t.name}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                />
                <FieldError msg={errors.topicId?.message} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="grade">Class / grade</Label>
                <Input id="grade" type="number" min={1} max={12} aria-invalid={!!errors.grade} {...register("grade")} />
                <FieldError msg={errors.grade?.message} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="difficulty">Difficulty</Label>
                <Controller
                  control={control}
                  name="difficulty"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="difficulty"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy">Easy</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="hard">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueDate">Due date</Label>
                <Input id="dueDate" type="datetime-local" aria-invalid={!!errors.dueDate} {...register("dueDate")} />
                <FieldError msg={errors.dueDate?.message} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="estimatedMinutes">Estimated time (minutes)</Label>
                <Input id="estimatedMinutes" type="number" min={5} max={180} aria-invalid={!!errors.estimatedMinutes} {...register("estimatedMinutes")} />
                <FieldError msg={errors.estimatedMinutes?.message} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" placeholder="What is this assignment about?" aria-invalid={!!errors.description} {...register("description")} />
                <FieldError msg={errors.description?.message} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="instructions">Instructions <span className="font-normal text-muted-foreground">(one per line)</span></Label>
                <Textarea id="instructions" className="min-h-[90px]" {...register("instructions")} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Questions</CardTitle>
                <p className="text-sm text-muted-foreground">{fields.length} question{fields.length === 1 ? "" : "s"} · Maximum marks: <b className="text-foreground">{total}</b></p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => append({ text: "", marks: 5, expectedAnswer: "" })} disabled={fields.length >= 25}>
                <Plus /> Add question
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {typeof errors.questions?.message === "string" && <FieldError msg={errors.questions.message} />}
              <AnimatePresence initial={false}>
                {fields.map((f, i) => (
                  <motion.div key={f.id} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} className="rounded-2xl border bg-paper p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm font-semibold"><GripVertical className="h-4 w-4 text-indigo-200" /> Question {i + 1}</span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => remove(i)} disabled={fields.length === 1} aria-label={`Remove question ${i + 1}`}>
                        <Trash2 className="text-coral-dark" />
                      </Button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-[1fr_110px]">
                      <div className="space-y-1.5">
                        <Label htmlFor={`q-${i}-text`} className="sr-only">Question text</Label>
                        <Textarea id={`q-${i}-text`} placeholder="Type the question" className="min-h-[64px]" aria-invalid={!!errors.questions?.[i]?.text} {...register(`questions.${i}.text`)} />
                        <FieldError msg={errors.questions?.[i]?.text?.message} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`q-${i}-marks`} className="text-xs">Marks</Label>
                        <Input id={`q-${i}-marks`} type="number" min={1} max={50} aria-invalid={!!errors.questions?.[i]?.marks} {...register(`questions.${i}.marks`)} />
                        <FieldError msg={errors.questions?.[i]?.marks?.message} />
                      </div>
                      <div className="space-y-1.5 md:col-span-2">
                        <Label htmlFor={`q-${i}-ans`} className="text-xs">Expected answer</Label>
                        <Input id={`q-${i}-ans`} placeholder="Model answer used for evaluation" aria-invalid={!!errors.questions?.[i]?.expectedAnswer} {...register(`questions.${i}.expectedAnswer`)} />
                        <FieldError msg={errors.questions?.[i]?.expectedAnswer?.message} />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Marking & reference</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="markingScheme">Marking scheme <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Textarea id="markingScheme" placeholder="e.g. 50% marks for method, 50% for the final answer. Deduct 1 mark for missing units." className="min-h-[100px]" {...register("markingScheme")} />
              </div>
              <div className="space-y-2">
                <Label>Reference worksheet <span className="font-normal text-muted-foreground">(optional)</span></Label>
                {refName ? (
                  <div className="flex items-center gap-3 rounded-xl border bg-paper p-3">
                    <FileUp className="h-5 w-5 text-indigo-400" />
                    <span className="flex-1 truncate text-sm font-medium">{refName}</span>
                    <Button type="button" size="icon" variant="ghost" onClick={() => setValue("referenceFileName", "")} aria-label="Remove worksheet"><X /></Button>
                  </div>
                ) : (
                  <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-indigo-200 p-6 text-center text-sm text-muted-foreground hover:bg-secondary/40">
                    <FileUp className="h-6 w-6 text-indigo-400" />
                    <span className="font-semibold text-indigo">Upload PDF or image</span>
                    <span className="text-xs">Stored by name only in this demo</span>
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      className="sr-only"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) setValue("referenceFileName", f.name);
                      }}
                    />
                  </label>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="sticky bottom-4 z-10 flex flex-col-reverse gap-2 rounded-2xl border bg-card/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" size="lg" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" /> : <Save />}
              {existing ? "Save changes" : "Create assignment"}
            </Button>
          </div>
        </>
      )}
    </form>
  );
}
