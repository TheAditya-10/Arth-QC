"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { NotFoundState, PageSkeleton } from "@/components/shared/states";
import { AssignmentForm } from "@/components/parent/assignment-form";
import { useAssignmentsRaw } from "@/hooks/use-data";

export default function EditAssignment() {
  const { id } = useParams<{ id: string }>();
  const assignments = useAssignmentsRaw();
  if (!assignments) return <PageSkeleton cards={2} />;
  const a = assignments.find((x) => x.id === id);
  if (!a) return <NotFoundState what="assignment" backHref="/parent/assignments" backLabel="Back to assignments" />;
  return (
    <div className="mx-auto max-w-4xl">
      <Link href={`/parent/assignments/${a.id}`} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-500 hover:text-indigo">
        <ArrowLeft className="h-4 w-4" /> Back to assignment
      </Link>
      <PageHeader title="Edit assignment" description={a.title} />
      <AssignmentForm existing={a} />
    </div>
  );
}
