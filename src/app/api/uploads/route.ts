import { handler, parseJson } from "@/lib/security/route";
import { requireActor } from "@/lib/security/actor";
import { rateLimit } from "@/lib/security/rate-limit";
import { requestUpload, uploadRequestSchema } from "@/lib/storage/upload.service";

/** Step 1 of an upload: validate metadata + permission, return a presigned PUT URL. */
export const POST = handler(async (req) => {
  const actor = await requireActor();
  await rateLimit(`upload:${actor.userId}`, 60, 3600);
  return requestUpload(actor, await parseJson(req, uploadRequestSchema));
});
