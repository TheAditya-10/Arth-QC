import { z } from "zod";
import { handler, parseJson } from "@/lib/security/route";
import { requireParent, resolveStudentId } from "@/lib/security/actor";
import { rateLimit } from "@/lib/security/rate-limit";
import { sendTestReport } from "@/lib/services/report.service";

export const POST = handler(async (req) => {
  const actor = await requireParent();
  await rateLimit(`report-test:${actor.familyId}`, 5, 3600, "Test report limit reached — try again later.");
  const { studentProfileId } = await parseJson(req, z.object({ studentProfileId: z.string().uuid().optional() }));
  return sendTestReport(actor, await resolveStudentId(actor, studentProfileId));
});
