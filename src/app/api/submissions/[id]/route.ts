import { z } from "zod";
import { handler } from "@/lib/security/route";
import { requireParent } from "@/lib/security/actor";
import { deleteSubmission } from "@/lib/services/submission.service";

export const DELETE = handler<{ id: string }>(async (_req, { params }) => {
  await deleteSubmission(await requireParent(), z.string().uuid().parse(params.id));
  return { ok: true };
});
