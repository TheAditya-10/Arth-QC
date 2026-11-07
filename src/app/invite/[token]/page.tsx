"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/auth/auth-shell";
import { api, errorMessage } from "@/lib/client/api";
import { resetStore } from "@/lib/client/store";

interface Invite {
  familyName: string;
  inviterName: string;
  email: string;
  accountExists: boolean;
}

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Invite>("GET", `/api/invitations/${token}`)
      .then(setInvite)
      .catch((e) => setError(errorMessage(e, "This invitation is invalid or has expired.")));
  }, [token]);

  const accept = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api("POST", `/api/invitations/${token}`, invite?.accountExists ? {} : { name, password });
      resetStore();
      toast.success(`Welcome to ${invite?.familyName}!`);
      router.replace("/parent");
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <AuthShell title="Invitation unavailable">
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button asChild className="mt-4 w-full"><Link href="/login">Go to sign in</Link></Button>
      </AuthShell>
    );
  }
  if (!invite) {
    return (
      <AuthShell title="Checking invitation…">
        <Loader2 className="mx-auto h-6 w-6 animate-spin" />
      </AuthShell>
    );
  }
  return (
    <AuthShell title={`Join ${invite.familyName}`} subtitle={`${invite.inviterName} invited ${invite.email}`}>
      <form onSubmit={accept} className="space-y-4">
        {invite.accountExists ? (
          <p className="text-sm text-muted-foreground">
            You already have an account. <Link href={`/login?next=/invite/${token}`} className="font-semibold text-indigo hover:underline">Sign in as {invite.email}</Link>, then accept here.
          </p>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="name">Your name</Label>
              <Input id="name" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Choose a password</Label>
              <Input id="password" type="password" required minLength={10} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <p className="text-xs text-muted-foreground">At least 10 characters with a letter and a number.</p>
            </div>
          </>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy && <Loader2 className="animate-spin" />} Accept invitation</Button>
      </form>
    </AuthShell>
  );
}
