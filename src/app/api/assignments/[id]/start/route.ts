import { z } from "zod";
import { handler } from "@/lib/security/route";
import { requireStudent } from "@/lib/security/actor";
import { markStarted } from "@/lib/services/assignment.service";

export const POST = handler<{ id: string }>(async (_req, { params }) => {
  await markStarted(await requireStudent(), z.string().uuid().parse(params.id));
  return { ok: true };
});
