import { handler, parseJson } from "@/lib/security/route";
import { requireParent } from "@/lib/security/actor";
import { rateLimit } from "@/lib/security/rate-limit";
import { generateAssignmentSchema } from "@/lib/validation/assignment";
import { generateAssignmentDraft } from "@/lib/services/assignment.service";
import { AIError } from "@/lib/ai/provider";
import { AppError } from "@/lib/security/errors";

export const maxDuration = 60;

export const POST = handler(async (req) => {
  const actor = await requireParent();
  await rateLimit(`ai-generate:${actor.familyId}`, 20, 86400, "Daily AI generation limit reached. Try again tomorrow or write questions manually.");
  try {
    return await generateAssignmentDraft(actor, await parseJson(req, generateAssignmentSchema));
  } catch (e) {
    if (e instanceof AIError) throw new AppError("AI_UNAVAILABLE", e.kind === "quota_exhausted" ? "The AI quota is used up for now. Please try later or write questions manually." : "AI generation is unavailable right now. Please try again shortly.");
    throw e;
  }
});
