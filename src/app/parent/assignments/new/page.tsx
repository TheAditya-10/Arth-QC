"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { AssignmentForm } from "@/components/parent/assignment-form";

export default function NewAssignment() {
  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/parent/assignments" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-500 hover:text-indigo">
        <ArrowLeft className="h-4 w-4" /> Assignments
      </Link>
      <PageHeader title="Create assignment" description="Write your own questions or let AI draft them for you to review." />
      <AssignmentForm />
    </div>
  );
}
