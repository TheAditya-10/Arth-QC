import { z } from "zod";
import { handler, parseJson } from "@/lib/security/route";
import { requireParent } from "@/lib/security/actor";
import { resetPinSchema } from "@/lib/validation/account";
import { resetStudentPin } from "@/lib/services/account.service";

export const POST = handler<{ id: string }>(async (req, { params }) => {
  const actor = await requireParent();
  const { pin } = await parseJson(req, resetPinSchema);
  await resetStudentPin(actor, z.string().uuid().parse(params.id), pin);
  return { ok: true };
});
