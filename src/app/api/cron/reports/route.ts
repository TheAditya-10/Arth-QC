import { handler } from "@/lib/security/route";
import { assertCron } from "@/lib/security/cron";
import { retryFailedDeliveries, runScheduledReports } from "@/lib/services/report.service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Generates and emails due weekly reports (idempotent), then retries failed deliveries. */
export const GET = handler(async (req) => {
  assertCron(req);
  const generated = await runScheduledReports();
  const retried = await retryFailedDeliveries();
  return { generated, retried };
});
