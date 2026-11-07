import { handler } from "@/lib/security/route";
import { assertCron } from "@/lib/security/cron";
import { cleanupAbandonedUploads } from "@/lib/storage/upload.service";
import { purgeOldMessages } from "@/lib/services/buddy.service";
import { processPendingJobs } from "@/lib/services/evaluation.service";
import { maintenanceSweep } from "@/lib/services/maintenance.service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Daily housekeeping: retention, abandoned uploads, stale jobs, old rate-limit rows. */
export const GET = handler(async (req) => {
  assertCron(req);
  const uploads = await cleanupAbandonedUploads();
  const chats = await purgeOldMessages();
  const sweep = await maintenanceSweep();
  const jobs = await processPendingJobs();
  return { uploadsDeleted: uploads, chatMessagesPurged: chats, ...sweep, jobsProcessed: jobs.length };
});
