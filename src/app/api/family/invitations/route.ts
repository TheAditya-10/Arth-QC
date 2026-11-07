import { handler, parseJson } from "@/lib/security/route";
import { requireParent } from "@/lib/security/actor";
import { rateLimit } from "@/lib/security/rate-limit";
import { inviteSchema } from "@/lib/validation/account";
import { inviteParent, listInvitations } from "@/lib/services/account.service";

export const GET = handler(async () => listInvitations(await requireParent()));

export const POST = handler(async (req) => {
  const actor = await requireParent();
  await rateLimit(`invite:${actor.userId}`, 10, 86400, "Daily invitation limit reached.");
  const input = await parseJson(req, inviteSchema);
  return inviteParent(actor, input.email, input.relation);
});
