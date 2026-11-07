import type { Metadata } from "next";
import { StudentShell } from "@/components/student/student-shell";

export const metadata: Metadata = { title: { default: "Student", template: "%s · Arth-QC" } };

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <StudentShell>{children}</StudentShell>;
}
