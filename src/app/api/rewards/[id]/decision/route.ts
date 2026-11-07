import { z } from "zod";
import { handler, parseJson } from "@/lib/security/route";
import { requireParent } from "@/lib/security/actor";
import { decideRedemption, decisionSchema } from "@/lib/services/reward.service";

export const POST = handler<{ id: string }>(async (req, { params }) => {
  await decideRedemption(await requireParent(), z.string().uuid().parse(params.id), await parseJson(req, decisionSchema));
  return { ok: true };
});
