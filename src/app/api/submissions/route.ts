import { after } from "next/server";
import { handler, parseJson } from "@/lib/security/route";
import { requireStudent } from "@/lib/security/actor";
import { rateLimit } from "@/lib/security/rate-limit";
import { createSubmission, createSubmissionSchema } from "@/lib/services/submission.service";
import { processPendingJobs } from "@/lib/services/evaluation.service";

export const maxDuration = 300;

/**
 * Finalise a submission. Responds immediately; evaluation runs after the response
 * (and is also picked up by the cron worker / status polling if this instance stops).
 */
export const POST = handler(async (req) => {
  const actor = await requireStudent();
  await rateLimit(`submit:${actor.userId}`, 20, 3600);
  const result = await createSubmission(actor, await parseJson(req, createSubmissionSchema));
  if (result.jobId && !result.duplicate) {
    const jobId = result.jobId;
    after(async () => {
      try {
        await processPendingJobs(1, jobId);
      } catch (e) {
        console.error("[submissions] post-response evaluation failed", e);
      }
    });
  }
  return result;
});
