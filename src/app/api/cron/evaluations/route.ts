import { handler } from "@/lib/security/route";
import { assertCron } from "@/lib/security/cron";
import { processPendingJobs } from "@/lib/services/evaluation.service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Bounded batch worker for queued / retrying / stale evaluation jobs. */
export const GET = handler(async (req) => {
  assertCron(req);
  return { processed: await processPendingJobs() };
});
