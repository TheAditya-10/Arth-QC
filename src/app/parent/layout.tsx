import type { Metadata } from "next";
import { ParentShell } from "@/components/parent/parent-shell";

export const metadata: Metadata = { title: { default: "Parent", template: "%s · Arth-QC Parent" } };

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  return <ParentShell>{children}</ParentShell>;
}
