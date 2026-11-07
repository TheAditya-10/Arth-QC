import { handler, parseJson } from "@/lib/security/route";
import { requireParent } from "@/lib/security/actor";
import { studentSettingsSchema, updateStudentProfile } from "@/lib/services/settings.service";

export const PATCH = handler(async (req) => {
  await updateStudentProfile(await requireParent(), await parseJson(req, studentSettingsSchema));
  return { ok: true };
});
