import { after } from "next/server";
import { z } from "zod";
import { handler, parseJson } from "@/lib/security/route";
import { requireParent } from "@/lib/security/actor";
import { rateLimit } from "@/lib/security/rate-limit";
import { retryEvaluation } from "@/lib/services/submission.service";
import { processPendingJobs } from "@/lib/services/evaluation.service";

export const maxDuration = 300;

export const POST = handler<{ id: string }>(async (req, { params }) => {
  const actor = await requireParent();
  await rateLimit(`retry-eval:${actor.familyId}`, 20, 86400);
  const { newVersion } = await parseJson(req, z.object({ newVersion: z.boolean().default(false) }));
  const { jobId } = await retryEvaluation(actor, z.string().uuid().parse(params.id), newVersion);
  after(() => processPendingJobs(1, jobId).catch((e) => console.error("[retry] failed", e)));
  return { ok: true };
});
