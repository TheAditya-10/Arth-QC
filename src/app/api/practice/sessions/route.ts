import { handler, parseJson } from "@/lib/security/route";
import { requireStudent } from "@/lib/security/actor";
import { rateLimit } from "@/lib/security/rate-limit";
import { startPracticeSchema, startSession } from "@/lib/services/practice.service";

export const maxDuration = 60;

export const POST = handler(async (req) => {
  const actor = await requireStudent();
  await rateLimit(`practice:${actor.userId}`, 40, 3600);
  return startSession(actor, await parseJson(req, startPracticeSchema));
});
