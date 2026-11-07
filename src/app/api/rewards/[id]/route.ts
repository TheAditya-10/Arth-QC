import { z } from "zod";
import { handler, parseJson } from "@/lib/security/route";
import { requireParent } from "@/lib/security/actor";
import { deleteReward, rewardInputSchema, updateReward } from "@/lib/services/reward.service";

const id = z.string().uuid();
export const PUT = handler<{ id: string }>(async (req, { params }) => {
  await updateReward(await requireParent(), id.parse(params.id), await parseJson(req, rewardInputSchema));
  return { ok: true };
});
export const DELETE = handler<{ id: string }>(async (_req, { params }) => {
  await deleteReward(await requireParent(), id.parse(params.id));
  return { ok: true };
});
