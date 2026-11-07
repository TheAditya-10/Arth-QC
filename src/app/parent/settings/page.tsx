"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Bell, CalendarClock, Copy, Gift, GraduationCap, KeyRound, Loader2, MailPlus, Save, Settings2, UserPlus, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/states";
import { useWholeDB } from "@/hooks/use-data";
import { settingsService } from "@/lib/client";
import { errorMessage } from "@/lib/client/api";
import { studentProfileSchema, type StudentProfileInput, type StudentProfileValues } from "@/lib/validations/assignment";
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
        try {
          await settingsService.updateStudentProfile(v);
          toast.success("Student profile saved");
        } catch (e) {
          toast.error(errorMessage(e));
        }
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

const parentFormSchema = z.object({ name: z.string().trim().min(2, "Enter a name"), relation: z.enum(["Mother", "Father", "Guardian"]) });

function ParentForm({ parent, isSelf }: { parent: User; isSelf: boolean }) {
  const { register, control, handleSubmit, formState } = useForm<z.infer<typeof parentFormSchema>>({
    resolver: zodResolver(parentFormSchema),
    defaultValues: { name: parent.name, relation: parent.relation ?? "Guardian" },
  });
  return (
    <form
      onSubmit={handleSubmit(async (v) => {
        try {
          await settingsService.updateParentProfile(parent.id, v);
          toast.success("Profile saved");
        } catch (e) {
          toast.error(errorMessage(e));
        }
      })}
      className="space-y-3 rounded-xl border p-4"
      noValidate
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_140px]">
        <div className="space-y-1.5">
          <Label htmlFor={`${parent.id}-name`}>Name {isSelf && <span className="text-xs font-normal text-muted-foreground">(you)</span>}</Label>
          <Input id={`${parent.id}-name`} disabled={!isSelf} aria-invalid={!!formState.errors.name} {...register("name")} />
          <Err m={formState.errors.name?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${parent.id}-email`}>Email</Label>
          <Input id={`${parent.id}-email`} value={parent.email} disabled readOnly />
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

function InviteParentDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [email, setEmail] = useState("");
  const [relation, setRelation] = useState<"Mother" | "Father" | "Guardian">("Father");
  const [busy, setBusy] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setDevLink(null); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite another parent</DialogTitle>
          <DialogDescription>They&apos;ll get an email with a secure link. Access is granted only after they accept with that email address.</DialogDescription>
        </DialogHeader>
        {devLink ? (
          <div className="space-y-2 rounded-xl bg-sun-light p-3 text-sm">
            <p className="font-semibold">Email isn&apos;t configured on this server, so share this link yourself:</p>
            <div className="flex gap-2">
              <Input readOnly value={devLink} />
              <Button type="button" size="icon" variant="outline" onClick={() => { void navigator.clipboard.writeText(devLink); toast.success("Link copied"); }} aria-label="Copy link"><Copy /></Button>
            </div>
          </div>
        ) : (
          <form
            id="invite-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                const res = await settingsService.inviteParent(email.trim(), relation);
                if (res.devLink) setDevLink(res.devLink);
                else {
                  toast.success("Invitation sent", { description: `We emailed ${email}.` });
                  onOpenChange(false);
                  setEmail("");
                }
              } catch (err) {
                toast.error(errorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
            className="grid gap-3 sm:grid-cols-[1fr_140px]"
          >
            <div className="space-y-1.5">
              <Label htmlFor="inv-email">Email</Label>
              <Input id="inv-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-rel">Relation</Label>
              <Select value={relation} onValueChange={(v) => setRelation(v as typeof relation)}>
                <SelectTrigger id="inv-rel"><SelectValue /></SelectTrigger>
                <SelectContent>{["Mother", "Father", "Guardian"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </form>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{devLink ? "Done" : "Cancel"}</Button>
          {!devLink && <Button type="submit" form="invite-form" disabled={busy}>{busy && <Loader2 className="animate-spin" />} Send invitation</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const newStudentSchema = z.object({
  displayName: z.string().trim().min(2, "Enter a name").max(40),
  username: z.string().trim().toLowerCase().min(3, "At least 3 characters").max(24).regex(/^[a-z0-9_.]+$/, "Lowercase letters, numbers, dots or underscores"),
  pin: z.string().regex(/^\d{6,8}$/, "6–8 digits"),
  grade: z.coerce.number().int().min(1).max(12),
  school: z.string().trim().max(80).default(""),
});

function AddStudentDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { register, handleSubmit, formState, reset } = useForm<z.input<typeof newStudentSchema>, unknown, z.infer<typeof newStudentSchema>>({
    resolver: zodResolver(newStudentSchema),
    defaultValues: { grade: 6, school: "" },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a student login</DialogTitle>
          <DialogDescription>Students sign in with a username and a secret PIN — no email needed.</DialogDescription>
        </DialogHeader>
        <form
          id="add-student"
          noValidate
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={handleSubmit(async (v) => {
            try {
              await settingsService.createStudent(v);
              toast.success(`${v.displayName}'s account is ready`, { description: `Username: ${v.username}` });
              reset({ grade: 6, school: "" });
              onOpenChange(false);
            } catch (e) {
              toast.error(errorMessage(e));
            }
          })}
        >
          <div className="space-y-1.5">
            <Label htmlFor="ns-name">Child&apos;s name</Label>
            <Input id="ns-name" aria-invalid={!!formState.errors.displayName} {...register("displayName")} />
            <Err m={formState.errors.displayName?.message} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ns-user">Username</Label>
            <Input id="ns-user" autoCapitalize="none" aria-invalid={!!formState.errors.username} {...register("username")} />
            <Err m={formState.errors.username?.message} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ns-pin">PIN (6–8 digits)</Label>
            <Input id="ns-pin" inputMode="numeric" type="password" autoComplete="new-password" aria-invalid={!!formState.errors.pin} {...register("pin")} />
            <Err m={formState.errors.pin?.message} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ns-grade">Class</Label>
            <Input id="ns-grade" type="number" min={1} max={12} {...register("grade")} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ns-school">School (optional)</Label>
            <Input id="ns-school" {...register("school")} />
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="add-student" disabled={formState.isSubmitting}>{formState.isSubmitting && <Loader2 className="animate-spin" />} Create login</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPinDialog({ student, onClose }: { student: { id: string; name: string } | null; onClose: () => void }) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={Boolean(student)} onOpenChange={(o) => { if (!o) { onClose(); setPin(""); } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Reset {student?.name}&apos;s PIN</DialogTitle>
          <DialogDescription>They&apos;ll be signed out on all devices and can sign in with the new PIN.</DialogDescription>
        </DialogHeader>
        <Input inputMode="numeric" type="password" placeholder="New 6–8 digit PIN" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))} aria-label="New PIN" />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={busy || pin.length < 6}
            onClick={async () => {
              if (!student) return;
              setBusy(true);
              try {
                await settingsService.resetStudentPin(student.id, pin);
                toast.success("PIN updated");
                onClose();
                setPin("");
              } catch (e) {
                toast.error(errorMessage(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Loader2 className="animate-spin" />} Save PIN
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  { k: "achievementUnlocked", label: "Badges & rewards", desc: "When a badge unlocks or a reward is requested" },
  { k: "weakTopicAlerts", label: "Weak topic alerts", desc: "When a topic drops below 60%" },
];

export default function SettingsPage() {
  const db = useWholeDB();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [pinFor, setPinFor] = useState<{ id: string; name: string } | null>(null);
  if (!db) return <PageSkeleton />;
  const parents = db.users.filter((u) => u.role === "parent");
  const n = db.notificationPrefs;
  const p = db.appPrefs;
  const save = async (fn: () => Promise<void>, msg = "Preference saved") => {
    try {
      await fn();
      toast.success(msg);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader eyebrow="Settings" title="Settings" description="Profiles, family members, notifications and preferences." />

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2"><GraduationCap className="h-5 w-5" /> Students</CardTitle>
            <CardDescription>Student logins use a username and PIN.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => setAddStudentOpen(true)}><UserPlus /> Add student</Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {db.viewer.students.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sun font-heading text-sm font-bold">{s.name[0]}</span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{s.name} {s.id === db.viewer.activeStudentId && <span className="ml-1 rounded bg-lavender px-1.5 text-xs font-semibold">viewing</span>}</p>
                <p className="text-xs text-muted-foreground">Class {s.grade} · username <b>{s.username}</b></p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setPinFor({ id: s.id, name: s.name })}><KeyRound /> Reset PIN</Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{db.student.name}&apos;s profile, class & curriculum</CardTitle>
        </CardHeader>
        <CardContent><StudentForm key={db.student.id + db.student.name + db.student.grade} student={db.student} /></CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Parents</CardTitle>
            <CardDescription>Every parent can assign homework and receives weekly reports.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => setInviteOpen(true)}><MailPlus /> Invite parent</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {parents.map((pp) => <ParentForm key={pp.id + pp.name + pp.relation} parent={pp} isSelf={pp.id === db.viewer.userId} />)}
          {db.invitations.map((inv) => (
            <div key={inv.id} className="flex items-center gap-3 rounded-xl border border-dashed p-3 text-sm">
              <MailPlus className="h-4 w-4 text-indigo-400" />
              <span className="flex-1">Invitation pending for <b>{inv.email}</b></span>
              <Button size="sm" variant="ghost" onClick={() => save(() => settingsService.revokeInvitation(inv.id), "Invitation revoked")} aria-label={`Revoke invitation for ${inv.email}`}><X /></Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" /> Notifications</CardTitle></CardHeader>
          <CardContent className="divide-y">
            {NOTIFS.map((x) => <ToggleRow key={x.k} id={`n-${x.k}`} label={x.label} desc={x.desc} checked={n[x.k]} onChange={(v) => save(() => settingsService.updateNotificationPrefs({ [x.k]: v }))} />)}
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5" /> Weekly report schedule</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>{db.reportSettings.enabled ? <>Reports go out every <b>{db.reportSettings.day}</b> at <b>{db.reportSettings.time}</b> ({db.viewer.timezone}) to {db.reportSettings.recipients.filter((r) => r.enabled).length} recipient(s).</> : "Automatic weekly reports are paused."}</p>
              <Button asChild variant="outline" size="sm"><Link href="/parent/reports">Manage schedule & recipients</Link></Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Gift className="h-5 w-5" /> Reward preferences</CardTitle></CardHeader>
            <CardContent className="divide-y">
              <ToggleRow id="p-auto" label="Auto-unlock rewards" desc="Show a reward as unlocked when its milestone is reached (you still approve and deliver it)" checked={p.autoUnlockRewards} onChange={(v) => save(() => settingsService.updateAppPrefs({ autoUnlockRewards: v }))} />
              <ToggleRow id="p-cel" label="Celebration animations" desc="Show a pop-up when badges unlock" checked={p.celebrations} onChange={(v) => save(() => settingsService.updateAppPrefs({ celebrations: v }))} />
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Settings2 className="h-5 w-5" /> Student app preferences</CardTitle></CardHeader>
        <CardContent className="divide-y">
          <ToggleRow id="p-sound" label="Sound effects" desc="Play sounds for correct answers" checked={p.soundEffects} onChange={(v) => save(() => settingsService.updateAppPrefs({ soundEffects: v }))} />
          <ToggleRow id="p-hints" label="Show motivational messages" desc="Friendly tips on the student dashboard" checked={p.showLeaderboardHints} onChange={(v) => save(() => settingsService.updateAppPrefs({ showLeaderboardHints: v }))} />
          <div className="flex items-center justify-between gap-4 py-3">
            <div>
              <Label htmlFor="p-ai" className="text-[15px]">AI Buddy hint style</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">How much help Arthu gives in each hint (never the full answer)</p>
            </div>
            <Select value={p.aiHintLevel} onValueChange={(v) => save(() => settingsService.updateAppPrefs({ aiHintLevel: v as AppPreferences["aiHintLevel"] }))}>
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

      <InviteParentDialog open={inviteOpen} onOpenChange={setInviteOpen} />
      <AddStudentDialog open={addStudentOpen} onOpenChange={setAddStudentOpen} />
      <ResetPinDialog student={pinFor} onClose={() => setPinFor(null)} />
    </div>
  );
}
