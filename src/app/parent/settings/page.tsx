"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Bell, GraduationCap, Loader2, RotateCcw, Save, Settings2, Gift, Users, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/states";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useWholeDB } from "@/hooks/use-data";
import { settingsService } from "@/lib/services";
import {
  parentProfileSchema,
  studentProfileSchema,
  type ParentProfileValues,
  type StudentProfileInput,
  type StudentProfileValues,
} from "@/lib/validations/assignment";
import type { AppPreferences, NotificationPreferences, StudentProfile, User } from "@/types";

function Err({ m }: { m?: string }) {
  return m ? <p className="text-xs text-destructive">{m}</p> : null;
}

function StudentForm({ student }: { student: StudentProfile }) {
  const { register, control, handleSubmit, formState } = useForm<StudentProfileInput, unknown, StudentProfileValues>({
    resolver: zodResolver(studentProfileSchema),
    defaultValues: { name: student.name, grade: student.grade, curriculum: student.curriculum, school: student.school, dailyGoalMinutes: student.dailyGoalMinutes },
  });
  return (
    <form
      onSubmit={handleSubmit(async (v) => {
        await settingsService.updateStudentProfile(v);
        toast.success("Student profile saved");
      })}
      className="grid gap-4 sm:grid-cols-2"
      noValidate
    >
      <div className="space-y-1.5">
        <Label htmlFor="s-name">Name</Label>
        <Input id="s-name" aria-invalid={!!formState.errors.name} {...register("name")} />
        <Err m={formState.errors.name?.message} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="s-school">School</Label>
        <Input id="s-school" {...register("school")} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="s-grade">Class</Label>
        <Input id="s-grade" type="number" min={1} max={12} aria-invalid={!!formState.errors.grade} {...register("grade")} />
        <Err m={formState.errors.grade?.message} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="s-curr">Curriculum</Label>
        <Controller control={control} name="curriculum" render={({ field }) => (
          <Select value={field.value} onValueChange={field.onChange}>
            <SelectTrigger id="s-curr"><SelectValue /></SelectTrigger>
            <SelectContent>{["NCERT", "CBSE", "ICSE", "State Board"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        )} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="s-goal">Daily study goal (minutes)</Label>
        <Input id="s-goal" type="number" min={10} max={180} aria-invalid={!!formState.errors.dailyGoalMinutes} {...register("dailyGoalMinutes")} />
        <Err m={formState.errors.dailyGoalMinutes?.message} />
      </div>
      <div className="space-y-1.5">
        <Label>Subjects</Label>
        <div className="flex flex-wrap gap-2 pt-1 text-sm">
          <span className="rounded-full bg-indigo px-3 py-1 font-semibold text-white">Mathematics</span>
          <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">Science · soon</span>
          <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">English · soon</span>
        </div>
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={formState.isSubmitting}>{formState.isSubmitting ? <Loader2 className="animate-spin" /> : <Save />} Save student</Button>
      </div>
    </form>
  );
}

function ParentForm({ parent }: { parent: User }) {
  const { register, control, handleSubmit, formState } = useForm<ParentProfileValues>({
    resolver: zodResolver(parentProfileSchema),
    defaultValues: { name: parent.name, email: parent.email, relation: parent.relation ?? "Guardian" },
  });
  return (
    <form
      onSubmit={handleSubmit(async (v) => {
        await settingsService.updateParentProfile(parent.id, v);
        toast.success(`${v.name}'s profile saved`);
      })}
      className="space-y-3 rounded-xl border p-4"
      noValidate
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_140px]">
        <div className="space-y-1.5">
          <Label htmlFor={`${parent.id}-name`}>Name</Label>
          <Input id={`${parent.id}-name`} aria-invalid={!!formState.errors.name} {...register("name")} />
          <Err m={formState.errors.name?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${parent.id}-email`}>Email</Label>
          <Input id={`${parent.id}-email`} type="email" aria-invalid={!!formState.errors.email} {...register("email")} />
          <Err m={formState.errors.email?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${parent.id}-rel`}>Relation</Label>
          <Controller control={control} name="relation" render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id={`${parent.id}-rel`}><SelectValue /></SelectTrigger>
              <SelectContent>{["Mother", "Father", "Guardian"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          )} />
        </div>
      </div>
      <Button type="submit" size="sm" variant="outline" disabled={formState.isSubmitting}>{formState.isSubmitting ? <Loader2 className="animate-spin" /> : <Save />} Save</Button>
    </form>
  );
}

function ToggleRow({ id, label, desc, checked, onChange }: { id: string; label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <Label htmlFor={id} className="text-[15px]">{label}</Label>
        {desc && <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

const NOTIFS: { k: keyof NotificationPreferences; label: string; desc: string }[] = [
  { k: "submissionEvaluated", label: "Homework evaluated", desc: "When AI finishes checking a submission" },
  { k: "deadlineReminders", label: "Deadline reminders", desc: "A day before homework is due" },
  { k: "streakAlerts", label: "Streak alerts", desc: "If the streak is about to break" },
  { k: "achievementUnlocked", label: "Badges & rewards", desc: "When a badge or reward unlocks" },
  { k: "weakTopicAlerts", label: "Weak topic alerts", desc: "When a topic drops below 60%" },
];

export default function SettingsPage() {
  const db = useWholeDB();
  const [confirmReset, setConfirmReset] = useState(false);
  if (!db) return <PageSkeleton />;
  const parents = db.users.filter((u) => u.role === "parent");
  const n = db.notificationPrefs;
  const p = db.appPrefs;
  const setNotif = (k: keyof NotificationPreferences, v: boolean) => {
    settingsService.updateNotificationPrefs({ [k]: v });
    toast.success("Notification preference saved");
  };
  const setPref = <K extends keyof AppPreferences>(k: K, v: AppPreferences[K]) => {
    settingsService.updateAppPrefs({ [k]: v } as Partial<AppPreferences>);
    toast.success("Preference saved");
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader eyebrow="Settings" title="Settings" description="Profiles, notifications and preferences for Arth-QC." />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><GraduationCap className="h-5 w-5" /> Student profile, class & curriculum</CardTitle>
        </CardHeader>
        <CardContent><StudentForm key={db.student.name + db.student.grade} student={db.student} /></CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Parent profiles</CardTitle>
          <CardDescription>Both parents can assign homework and receive weekly reports.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">{parents.map((pp) => <ParentForm key={pp.id + pp.email} parent={pp} />)}</CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" /> Notifications</CardTitle></CardHeader>
          <CardContent className="divide-y">
            {NOTIFS.map((x) => <ToggleRow key={x.k} id={`n-${x.k}`} label={x.label} desc={x.desc} checked={n[x.k]} onChange={(v) => setNotif(x.k, v)} />)}
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5" /> Weekly report schedule</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>{db.reportSettings.enabled ? <>Reports go out every <b>{db.reportSettings.day}</b> at <b>{db.reportSettings.time}</b> to {db.reportSettings.recipients.filter((r) => r.enabled).length} recipient(s).</> : "Automatic weekly reports are paused."}</p>
              <Button asChild variant="outline" size="sm"><Link href="/parent/reports">Manage schedule & recipients</Link></Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Gift className="h-5 w-5" /> Reward preferences</CardTitle></CardHeader>
            <CardContent className="divide-y">
              <ToggleRow id="p-auto" label="Auto-unlock rewards" desc="Unlock a reward as soon as its milestone is reached" checked={p.autoUnlockRewards} onChange={(v) => setPref("autoUnlockRewards", v)} />
              <ToggleRow id="p-cel" label="Celebration animations" desc="Show a pop-up when badges unlock" checked={p.celebrations} onChange={(v) => setPref("celebrations", v)} />
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Settings2 className="h-5 w-5" /> Application preferences</CardTitle></CardHeader>
        <CardContent className="divide-y">
          <ToggleRow id="p-sound" label="Sound effects" desc="Play sounds for correct answers (student app)" checked={p.soundEffects} onChange={(v) => setPref("soundEffects", v)} />
          <ToggleRow id="p-hints" label="Show motivational hints" desc="Friendly tips on the student dashboard" checked={p.showLeaderboardHints} onChange={(v) => setPref("showLeaderboardHints", v)} />
          <div className="flex items-center justify-between gap-4 py-3">
            <div>
              <Label htmlFor="p-ai" className="text-[15px]">AI Buddy hint style</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">How much help Arthu gives in each hint</p>
            </div>
            <Select value={p.aiHintLevel} onValueChange={(v) => setPref("aiHintLevel", v as AppPreferences["aiHintLevel"])}>
              <SelectTrigger id="p-ai" className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="gentle">Gentle</SelectItem>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="detailed">Detailed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="border-coral/40">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">Reset demo data</p>
            <p className="text-sm text-muted-foreground">Restore all sample assignments, results and settings. Stored only in this browser.</p>
          </div>
          <Button variant="outline" className="text-destructive" onClick={() => setConfirmReset(true)}><RotateCcw /> Reset</Button>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Reset all demo data?"
        description="Everything you created or changed in this demo will be replaced with the original sample data."
        confirmLabel="Reset"
        destructive
        onConfirm={async () => {
          await settingsService.resetDemoData();
          toast.success("Demo data reset");
        }}
      />
    </div>
  );
}
