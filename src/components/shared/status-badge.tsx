import { Badge } from "@/components/ui/badge";
import type { AssignmentStatus, Difficulty, EvaluationStatus, ResultStatus } from "@/types";
import { CheckCircle2, Circle, Clock, AlertCircle, Loader2, XCircle, MinusCircle, ShieldCheck } from "lucide-react";

export function AssignmentStatusBadge({ status }: { status: AssignmentStatus }) {
  switch (status) {
    case "evaluated":
      return <Badge variant="mint"><CheckCircle2 /> Evaluated</Badge>;
    case "submitted":
      return <Badge variant="secondary"><Loader2 className="animate-spin" /> Submitted</Badge>;
    case "overdue":
      return <Badge variant="coral"><AlertCircle /> Overdue</Badge>;
    case "in_progress":
      return <Badge variant="sun"><Clock /> In progress</Badge>;
    default:
      return <Badge variant="outline"><Circle /> Pending</Badge>;
  }
}

export function EvaluationStatusBadge({ status }: { status: EvaluationStatus }) {
  switch (status) {
    case "processing":
      return <Badge variant="secondary"><Loader2 className="animate-spin" /> Processing</Badge>;
    case "reviewed":
      return <Badge variant="default"><ShieldCheck /> Parent reviewed</Badge>;
    case "failed":
      return <Badge variant="coral"><XCircle /> Failed</Badge>;
    case "needs_review":
      return <Badge variant="sun"><AlertCircle /> Needs review</Badge>;
    default:
      return <Badge variant="mint"><CheckCircle2 /> Evaluated</Badge>;
  }
}

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  const map = { easy: "mint", medium: "sun", hard: "coral" } as const;
  const dots = { easy: 1, medium: 2, hard: 3 }[difficulty];
  return (
    <Badge variant={map[difficulty]} className="capitalize">
      <span className="flex gap-0.5" aria-hidden>
        {[1, 2, 3].map((i) => (
          <span key={i} className={`h-1.5 w-1.5 rounded-full bg-current ${i <= dots ? "" : "opacity-25"}`} />
        ))}
      </span>
      {difficulty}
    </Badge>
  );
}

export function ResultStatusBadge({ status }: { status: ResultStatus }) {
  if (status === "correct") return <Badge variant="mint"><CheckCircle2 /> Correct</Badge>;
  if (status === "partial") return <Badge variant="sun"><MinusCircle /> Partially correct</Badge>;
  return <Badge variant="coral"><XCircle /> Incorrect</Badge>;
}
