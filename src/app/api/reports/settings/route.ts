import { handler, parseJson } from "@/lib/security/route";
import { requireParent } from "@/lib/security/actor";
import { reportSettingsSchema, updateReportSettings } from "@/lib/services/report.service";

export const PATCH = handler(async (req) => {
  await updateReportSettings(await requireParent(), await parseJson(req, reportSettingsSchema));
  return { ok: true };
});
