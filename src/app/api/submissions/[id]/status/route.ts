import { after } from "next/server";
import { z } from "zod";
import { handler } from "@/lib/security/route";
import { requireActor } from "@/lib/security/actor";
import { submissionStatus } from "@/lib/services/submission.service";
import { processPendingJobs } from "@/lib/services/evaluation.service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Polled by the processing screen. If the job is queued and due (e.g. the original
 * worker was terminated), polling nudges a bounded worker run for that job only.
 */
export const GET = handler<{ id: string }>(async (_req, { params }) => {
  const actor = await requireActor();
  const status = await submissionStatus(actor, z.string().uuid().parse(params.id));
  const due = status.nextRunAt ? new Date(status.nextRunAt).getTime() <= Date.now() : false;
  if (!status.done && status.jobId && due && (status.status === "QUEUED" || status.status === "UPLOADED")) {
    const jobId = status.jobId;
    after(() => processPendingJobs(1, jobId).catch((e) => console.error("[status] nudge failed", e)));
  }
  return status;
});
