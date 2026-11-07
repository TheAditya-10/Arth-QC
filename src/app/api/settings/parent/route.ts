import { handler, parseJson } from "@/lib/security/route";
import { requireParent } from "@/lib/security/actor";
import { parentSettingsSchema, updateParentProfile } from "@/lib/services/settings.service";

export const PATCH = handler(async (req) => {
  await updateParentProfile(await requireParent(), await parseJson(req, parentSettingsSchema));
  return { ok: true };
});
