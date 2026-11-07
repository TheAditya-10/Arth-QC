import { handler, parseJson } from "@/lib/security/route";
import { requireParent } from "@/lib/security/actor";
import { apiAssignmentSchema } from "@/lib/validation/assignment";
import { createAssignment } from "@/lib/services/assignment.service";

export const POST = handler(async (req) => createAssignment(await requireParent(), await parseJson(req, apiAssignmentSchema)));
