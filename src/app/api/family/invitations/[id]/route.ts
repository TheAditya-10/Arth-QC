import { z } from "zod";
import { handler } from "@/lib/security/route";
import { requireParent } from "@/lib/security/actor";
import { revokeInvitation } from "@/lib/services/account.service";

export const DELETE = handler<{ id: string }>(async (_req, { params }) => {
  await revokeInvitation(await requireParent(), z.string().uuid().parse(params.id));
  return { ok: true };
});
