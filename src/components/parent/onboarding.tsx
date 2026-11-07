"use client";

import { useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mascot } from "@/components/shared/mascot";
import { settingsService } from "@/lib/client";
import { errorMessage } from "@/lib/client/api";
import { refresh } from "@/lib/client/store";

/** First-run screen for a new family: create the child's student login. */
export function Onboarding() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [grade, setGrade] = useState(6);
  const [busy, setBusy] = useState(false);
  return (
    <div className="mx-auto max-w-xl py-6">
      <div className="mb-5 flex items-center gap-4">
        <Mascot mood="wave" className="h-20 w-20" />
        <div>
          <h1 className="font-heading text-2xl font-bold">Welcome to Arth-QC!</h1>
          <p className="text-muted-foreground">Let&apos;s create your child&apos;s student login. They&apos;ll sign in with a username and a secret PIN — no email needed.</p>
        </div>
      </div>
      <form
        className="grid gap-4 rounded-3xl border bg-card p-6 shadow-soft sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await settingsService.createStudent({ displayName: name.trim(), username: username.trim().toLowerCase(), pin, grade, school: "" });
            toast.success(`${name}'s login is ready!`, { description: `Username: ${username.toLowerCase()}` });
            await refresh();
          } catch (err) {
            toast.error(errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="ob-name">Child&apos;s name</Label>
          <Input id="ob-name" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ob-grade">Class</Label>
          <Input id="ob-grade" type="number" min={1} max={12} value={grade} onChange={(e) => setGrade(Number(e.target.value))} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ob-user">Username</Label>
          <Input id="ob-user" required minLength={3} pattern="[a-zA-Z0-9_.]+" autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value)} />
          <p className="text-xs text-muted-foreground">Letters, numbers, dots or underscores.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ob-pin">Secret PIN (6–8 digits)</Label>
          <Input id="ob-pin" required inputMode="numeric" type="password" minLength={6} maxLength={8} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
        </div>
        <Button type="submit" size="lg" className="sm:col-span-2" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <UserPlus />} Create student login</Button>
      </form>
    </div>
  );
}
