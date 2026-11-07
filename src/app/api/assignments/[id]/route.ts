import { z } from "zod";
import { handler, parseJson } from "@/lib/security/route";
import { requireParent } from "@/lib/security/actor";
import { apiAssignmentSchema } from "@/lib/validation/assignment";
import { deleteAssignment, updateAssignment } from "@/lib/services/assignment.service";

const id = z.string().uuid();
export const PUT = handler<{ id: string }>(async (req, { params }) => updateAssignment(await requireParent(), id.parse(params.id), await parseJson(req, apiAssignmentSchema)));
export const DELETE = handler<{ id: string }>(async (_req, { params }) => {
  await deleteAssignment(await requireParent(), id.parse(params.id));
  return { ok: true };
});
