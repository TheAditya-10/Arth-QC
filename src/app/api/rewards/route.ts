import { handler, parseJson } from "@/lib/security/route";
import { requireParent } from "@/lib/security/actor";
import { createReward, rewardInputSchema } from "@/lib/services/reward.service";

export const POST = handler(async (req) => createReward(await requireParent(), await parseJson(req, rewardInputSchema)));
