import { handler, parseJson } from "@/lib/security/route";
import { linkedStudents, requireParent } from "@/lib/security/actor";
import { rateLimit } from "@/lib/security/rate-limit";
import { createStudentSchema } from "@/lib/validation/account";
import { createStudent } from "@/lib/services/account.service";

export const GET = handler(async () => linkedStudents(await requireParent()));

export const POST = handler(async (req) => {
  const actor = await requireParent();
  await rateLimit(`create-student:${actor.userId}`, 10, 86400);
  return createStudent(actor, await parseJson(req, createStudentSchema));
});
