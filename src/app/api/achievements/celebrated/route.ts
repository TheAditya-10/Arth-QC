import { z } from "zod";
import { handler, parseJson } from "@/lib/security/route";
import { requireStudent } from "@/lib/security/actor";
import { markCelebrated } from "@/lib/services/settings.service";

export const POST = handler(async (req) => {
  const { codes } = await parseJson(req, z.object({ codes: z.array(z.string().max(64)).max(20) }));
  await markCelebrated(await requireStudent(), codes);
  return { ok: true };
});
