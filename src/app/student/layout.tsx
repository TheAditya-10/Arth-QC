import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StudentShell } from "@/components/student/student-shell";
import { getActor } from "@/lib/security/actor";

export const metadata: Metadata = { title: { default: "Student", template: "%s · Arth-QC" } };
export const dynamic = "force-dynamic";

/** Server-side guard: only signed-in students reach the student app. */
export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActor();
  if (!actor) redirect("/login?as=student&next=/student");
  if (actor.role !== "STUDENT") redirect("/parent");
  return <StudentShell>{children}</StudentShell>;
}
