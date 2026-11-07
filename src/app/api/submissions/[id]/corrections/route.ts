import { z } from "zod";
import { handler, parseJson } from "@/lib/security/route";
import { requireParent } from "@/lib/security/actor";
import { correctEvaluation, correctionSchema } from "@/lib/services/submission.service";

export const POST = handler<{ id: string }>(async (req, { params }) => correctEvaluation(await requireParent(), z.string().uuid().parse(params.id), await parseJson(req, correctionSchema)));
