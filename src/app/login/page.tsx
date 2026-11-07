"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GraduationCap, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuthShell } from "@/components/auth/auth-shell";
import { authClient } from "@/lib/auth/client";
import { resetStore } from "@/lib/client/store";

function safeNext(next: string | null, fallback: string) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

function LoginInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [tab, setTab] = useState(params.get("as") === "student" ? "student" : "parent");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const done = (role: "parent" | "student") => {
    resetStore();
    router.replace(safeNext(params.get("next"), role === "student" ? "/student" : "/parent"));
    router.refresh();
  };

  const signInParent = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await authClient.signIn.email({ email: email.trim().toLowerCase(), password });
    setBusy(false);
    if (error) setError(error.message ?? "Couldn't sign in. Check your email and password.");
    else done("parent");
  };

  const signInStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await authClient.signIn.username({ username: username.trim().toLowerCase(), password: pin });
    setBusy(false);
    if (error) setError(error.message === "Invalid username or password" ? "That username or PIN doesn't match. Try again!" : error.message ?? "Couldn't sign in.");
    else done("student");
  };

  return (
    <AuthShell title="Welcome back!" subtitle="Sign in to continue learning">
      <Tabs value={tab} onValueChange={(v) => { setTab(v); setError(null); }}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="parent"><Users className="h-4 w-4" /> Parent</TabsTrigger>
          <TabsTrigger value="student"><GraduationCap className="h-4 w-4" /> Student</TabsTrigger>
        </TabsList>
        {error && <p role="alert" className="mt-4 rounded-xl bg-coral-light px-3 py-2 text-sm font-medium text-coral-dark">{error}</p>}
        <TabsContent value="parent">
          <form onSubmit={signInParent} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy && <Loader2 className="animate-spin" />} Sign in</Button>
            <p className="text-center text-sm text-muted-foreground">
              New to Arth-QC? <Link href="/register" className="font-semibold text-indigo hover:underline">Create a family account</Link>
            </p>
          </form>
        </TabsContent>
        <TabsContent value="student">
          <form onSubmit={signInStudent} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input id="username" autoComplete="username" autoCapitalize="none" required value={username} onChange={(e) => setUsername(e.target.value)} className="h-12 text-lg" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pin">Secret PIN</Label>
              <Input
                id="pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="current-password"
                required
                minLength={6}
                maxLength={8}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                className="h-12 text-center text-2xl tracking-[0.5em]"
              />
            </div>
            <Button type="submit" size="lg" variant="sun" className="w-full" disabled={busy}>{busy && <Loader2 className="animate-spin" />} Let&apos;s go!</Button>
            <p className="text-center text-xs text-muted-foreground">Forgot your PIN? Ask Mumma or Papa to reset it in their settings.</p>
          </form>
        </TabsContent>
      </Tabs>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
