"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AuthShell } from "@/components/auth/auth-shell";
import { api, errorMessage } from "@/lib/client/api";
import { resetStore } from "@/lib/client/store";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your name"),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(10, "Use at least 10 characters").regex(/[A-Za-z]/, "Include a letter").regex(/[0-9]/, "Include a number"),
  familyName: z.string().trim().min(2, "Enter a family name"),
  relation: z.enum(["Mother", "Father", "Guardian"]),
});
type Values = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const { register, handleSubmit, control, formState } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { relation: "Mother" } });
  const { errors, isSubmitting } = formState;

  const onSubmit = async (v: Values) => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
      await api("POST", "/api/auth-flow/register", { ...v, timezone: tz });
      resetStore();
      toast.success("Family account created!", { description: "Next, add your child's student login in Settings." });
      router.replace("/parent");
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <AuthShell title="Create your family" subtitle="For parents — you'll add your child's login next">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-[1fr_130px]">
          <div className="space-y-1.5">
            <Label htmlFor="name">Your name</Label>
            <Input id="name" autoComplete="name" aria-invalid={!!errors.name} {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="relation">You are</Label>
            <Controller control={control} name="relation" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="relation"><SelectValue /></SelectTrigger>
                <SelectContent>{["Mother", "Father", "Guardian"].map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            )} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register("email")} />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} {...register("password")} />
          {errors.password ? <p className="text-xs text-destructive">{errors.password.message}</p> : <p className="text-xs text-muted-foreground">At least 10 characters with a letter and a number.</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="familyName">Family name</Label>
          <Input id="familyName" placeholder="e.g. Sharma Family" aria-invalid={!!errors.familyName} {...register("familyName")} />
          {errors.familyName && <p className="text-xs text-destructive">{errors.familyName.message}</p>}
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>{isSubmitting && <Loader2 className="animate-spin" />} Create account</Button>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account? <Link href="/login" className="font-semibold text-indigo hover:underline">Sign in</Link>
        </p>
      </form>
    </AuthShell>
  );
}
