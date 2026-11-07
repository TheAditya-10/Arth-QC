import { handler, parseJson } from "@/lib/security/route";
import { requireActor } from "@/lib/security/actor";
import { notificationSchema, updateNotifications } from "@/lib/services/settings.service";

export const PATCH = handler(async (req) => {
  await updateNotifications(await requireActor(), await parseJson(req, notificationSchema));
  return { ok: true };
});
