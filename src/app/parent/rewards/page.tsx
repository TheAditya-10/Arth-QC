"use client";

import { useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Gift, Loader2, MoreHorizontal, PackageCheck, Pencil, Plus, RotateCcw, Trash2, Unlock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/states";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { AchievementBadge } from "@/components/rewards/achievement-badge";
import { useAchievements, useRewards, useScoreStats, useStudent } from "@/hooks/use-data";
import { rewardService } from "@/lib/client";
import { TRIGGER_LABELS } from "@/lib/client/rewards.service";
import { rewardSchema, type RewardFormInput, type RewardFormValues } from "@/lib/validations/assignment";
import type { Reward, RewardTrigger } from "@/types";
import { cn, formatDate } from "@/lib/utils";
import { errorMessage } from "@/lib/client/api";

const EMOJIS = ["🎁", "🍨", "🏆", "📚", "🎉", "🌳", "🎮", "🍕", "⚽", "🎨", "🧩", "🚲"];
const GROUPS: { trigger: RewardTrigger; title: string; hint: string }[] = [
  { trigger: "streak", title: "Streak milestones", hint: "Reward consistency" },
  { trigger: "xp", title: "XP milestones", hint: "Reward overall effort" },
  { trigger: "score", title: "Score-based rewards", hint: "Reward accuracy" },
  { trigger: "improvement", title: "Improvement rewards", hint: "Reward growth" },
  { trigger: "custom", title: "Custom rewards", hint: "Unlock them yourself" },
];

const DEFAULT_THRESHOLD: Record<RewardTrigger, number> = { streak: 7, xp: 1500, score: 90, improvement: 15, custom: 0 };

function RewardDialog({ open, onOpenChange, editing, preset }: { open: boolean; onOpenChange: (o: boolean) => void; editing?: Reward; preset?: RewardTrigger }) {
  const values = useMemo<RewardFormInput>(
    () =>
      editing
        ? { title: editing.title, description: editing.description, trigger: editing.trigger, threshold: editing.threshold, emoji: editing.emoji }
        : { title: "", description: "", trigger: preset ?? "streak", threshold: DEFAULT_THRESHOLD[preset ?? "streak"], emoji: "🎁" },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editing, preset, open],
  );
  const form = useForm<RewardFormInput, unknown, RewardFormValues>({ resolver: zodResolver(rewardSchema), values });
  const { register, control, handleSubmit, watch, formState, setValue } = form;
  const trigger = watch("trigger");
  const emoji = watch("emoji");

  const submit = async (v: RewardFormValues) => {
    if (v.trigger === "score" && v.threshold > 100) {
      form.setError("threshold", { message: "Score must be 100% or less" });
      return;
    }
    if (editing) {
      await rewardService.updateReward(editing.id, v);
      toast.success("Reward updated");
    } else {
      const r = await rewardService.createReward(v);
      toast.success("Reward created", { description: r.status === "unlocked" ? "Already earned — it's unlocked!" : "The student can now see it in Rewards." });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit reward" : "Create a reward"}</DialogTitle>
          <DialogDescription>Rewards show up for the student with a progress bar.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label>Icon</Label>
            <div className="flex flex-wrap gap-1.5">
              {EMOJIS.map((e) => (
                <button key={e} type="button" onClick={() => setValue("emoji", e)} aria-label={`Use ${e}`} aria-pressed={emoji === e} className={cn("h-10 w-10 rounded-xl text-xl transition", emoji === e ? "bg-sun ring-2 ring-indigo" : "bg-secondary hover:bg-lavender-dark")}>{e}</button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="r-title">Reward</Label>
            <Input id="r-title" placeholder="e.g. Pizza night" aria-invalid={!!formState.errors.title} {...register("title")} />
            {formState.errors.title && <p className="text-xs text-destructive">{formState.errors.title.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="r-desc">Description</Label>
            <Textarea id="r-desc" placeholder="Optional details" {...register("description")} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="r-trigger">Unlocks by</Label>
              <Controller control={control} name="trigger" render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="r-trigger"><SelectValue /></SelectTrigger>
                  <SelectContent>{(Object.keys(TRIGGER_LABELS) as RewardTrigger[]).map((t) => <SelectItem key={t} value={t}>{TRIGGER_LABELS[t].label}</SelectItem>)}</SelectContent>
                </Select>
              )} />
            </div>
            {trigger !== "custom" && (
              <div className="space-y-2">
                <Label htmlFor="r-threshold">Target ({TRIGGER_LABELS[trigger].unit})</Label>
                <Input id="r-threshold" type="number" min={1} aria-invalid={!!formState.errors.threshold} {...register("threshold")} />
                {formState.errors.threshold && <p className="text-xs text-destructive">{formState.errors.threshold.message}</p>}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={formState.isSubmitting}>{formState.isSubmitting && <Loader2 className="animate-spin" />} {editing ? "Save" : "Create reward"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function ParentRewards() {
  const rewards = useRewards();
  const achievements = useAchievements();
  const student = useStudent();
  const stats = useScoreStats();
  const [dialog, setDialog] = useState<{ open: boolean; editing?: Reward; preset?: RewardTrigger }>({ open: false });
  const [toDelete, setToDelete] = useState<Reward | null>(null);

  if (!rewards || !achievements || !student || !stats) return <PageSkeleton />;
  const ctx = { streak: student.streak, xp: student.xp, ...stats };
  const requests = rewards.filter((r) => r.status === "requested");
  const toDeliver = rewards.filter((r) => r.status === "approved" || r.status === "unlocked");

  const decide = async (r: Reward, action: "approve" | "decline" | "deliver" | "grant" | "reset", msg: string) => {
    try {
      await rewardService.decideReward(r.id, action);
      toast.success(msg);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Motivation"
        title="Rewards management"
        description="Celebrate consistency, improvement and corrected mistakes — not just top marks."
        actions={<Button onClick={() => setDialog({ open: true })}><Plus /> New reward</Button>}
      />

      {requests.length > 0 && (
        <Card className="border-indigo-200 bg-lavender/50">
          <CardHeader><CardTitle className="flex items-center gap-2"><Gift className="h-5 w-5" /> {student.name} asked for ({requests.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {requests.map((r) => (
              <div key={r.id} className="flex flex-col gap-2 rounded-xl bg-card p-3 sm:flex-row sm:items-center">
                <span className="text-2xl" aria-hidden>{r.emoji}</span>
                <div className="flex-1">
                  <p className="font-semibold">{r.title}</p>
                  <p className="text-xs text-muted-foreground">Requested {r.requestedAt ? formatDate(r.requestedAt) : ""} · {TRIGGER_LABELS[r.trigger].describe(r.threshold)}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => decide(r, "decline", "Request declined")}>Decline</Button>
                  <Button size="sm" onClick={() => decide(r, "approve", "Approved — remember to deliver it!")}>Approve</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {toDeliver.length > 0 && (
        <Card className="border-sun bg-sun-light/40">
          <CardHeader><CardTitle className="flex items-center gap-2"><Gift className="h-5 w-5 text-sun-dark" /> Ready to deliver ({toDeliver.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {toDeliver.map((r) => (
              <div key={r.id} className="flex flex-col gap-2 rounded-xl bg-card p-3 sm:flex-row sm:items-center">
                <span className="text-2xl" aria-hidden>{r.emoji}</span>
                <div className="flex-1">
                  <p className="font-semibold">{r.title}</p>
                  <p className="text-xs text-muted-foreground">{r.status === "approved" ? "Approved" : "Earned"}{r.unlockedAt ? ` ${formatDate(r.unlockedAt)}` : ""} · {TRIGGER_LABELS[r.trigger].describe(r.threshold)}</p>
                </div>
                <Button size="sm" variant="mint" onClick={() => decide(r, "deliver", "Marked as delivered 🎉")}><PackageCheck /> Mark as delivered</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {GROUPS.map((g) => {
          const items = rewards.filter((r) => r.trigger === g.trigger);
          return (
            <Card key={g.trigger}>
              <CardHeader className="flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">{g.title}</CardTitle>
                  <p className="text-xs text-muted-foreground">{g.hint}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDialog({ open: true, preset: g.trigger })}
                  aria-label={`Add ${g.title}`}
                >
                  <Plus />
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {items.length === 0 && <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">No rewards yet.</p>}
                {items.map((r) => {
                  const p = rewardService.rewardProgress(r, ctx);
                  return (
                    <div key={r.id} className="flex items-center gap-3 rounded-xl border p-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-xl" aria-hidden>{r.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{r.title}</p>
                          <Badge variant={r.status === "delivered" ? "mint" : r.status === "locked" ? "muted" : "sun"} className="capitalize">{r.status}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{TRIGGER_LABELS[r.trigger].describe(r.threshold)}</p>
                        {r.status === "locked" && r.trigger !== "custom" && (
                          <div className="mt-1.5 flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-indigo" style={{ width: `${p}%` }} /></div>
                            <span className="text-[11px] font-semibold text-muted-foreground">{p}%</span>
                          </div>
                        )}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label={`Actions for ${r.title}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setDialog({ open: true, editing: r })}><Pencil /> Edit</DropdownMenuItem>
                          {(r.status === "locked" || r.status === "unlocked") && <DropdownMenuItem onSelect={() => decide(r, "grant", "Reward granted")}><Unlock /> Grant now</DropdownMenuItem>}
                          {r.status === "requested" && <DropdownMenuItem onSelect={() => decide(r, "approve", "Request approved")}><Unlock /> Approve request</DropdownMenuItem>}
                          {(r.status === "approved" || r.status === "unlocked" || r.status === "requested") && <DropdownMenuItem onSelect={() => decide(r, "deliver", "Marked as delivered 🎉")}><PackageCheck /> Mark delivered</DropdownMenuItem>}
                          {(r.status === "requested" || r.status === "approved") && <DropdownMenuItem onSelect={() => decide(r, "reset", "Reward reset")}><RotateCcw /> Reset</DropdownMenuItem>}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => setToDelete(r)} className="text-destructive focus:text-destructive"><Trash2 /> Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Achievements</CardTitle>
          <p className="text-sm text-muted-foreground">{achievements.filter((a) => a.unlockedAt).length} of {achievements.length} badges unlocked by {student.name}</p>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {achievements.map((a, i) => <AchievementBadge key={a.id} a={a} size="sm" index={i} />)}
        </CardContent>
      </Card>

      <RewardDialog open={dialog.open} editing={dialog.editing} preset={dialog.preset} onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))} />
      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete reward?"
        description={toDelete ? `"${toDelete.title}" will be removed.` : undefined}
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (toDelete) await rewardService.deleteReward(toDelete.id);
          toast.success("Reward deleted");
        }}
      />
    </div>
  );
}
