import { handler, parseJson } from "@/lib/security/route";
import { requireParent } from "@/lib/security/actor";
import { appPrefsSchema, updateAppPrefs } from "@/lib/services/settings.service";

export const PATCH = handler(async (req) => {
  await updateAppPrefs(await requireParent(), await parseJson(req, appPrefsSchema));
  return { ok: true };
});
