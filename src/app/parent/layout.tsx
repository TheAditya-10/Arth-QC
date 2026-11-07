import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ParentShell } from "@/components/parent/parent-shell";
import { getActor } from "@/lib/security/actor";

export const metadata: Metadata = { title: { default: "Parent", template: "%s · Arth-QC Parent" } };
export const dynamic = "force-dynamic";

/** Server-side guard: students can never open parent management screens. */
export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActor();
  if (!actor) redirect("/login?next=/parent");
  if (actor.role === "STUDENT") redirect("/student");
  return <ParentShell>{children}</ParentShell>;
}
