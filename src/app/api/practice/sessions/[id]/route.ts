import { z } from "zod";
import { handler } from "@/lib/security/route";
import { requireStudent } from "@/lib/security/actor";
import { abandonSession } from "@/lib/services/practice.service";

export const DELETE = handler<{ id: string }>(async (_req, { params }) => {
  await abandonSession(await requireStudent(), z.string().uuid().parse(params.id));
  return { ok: true };
});
