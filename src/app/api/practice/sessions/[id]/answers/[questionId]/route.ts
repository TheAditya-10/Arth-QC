import { z } from "zod";
import { handler, parseJson } from "@/lib/security/route";
import { requireStudent } from "@/lib/security/actor";
import { answerQuestion, answerSchema } from "@/lib/services/practice.service";

export const POST = handler<{ id: string; questionId: string }>(async (req, { params }) =>
  answerQuestion(await requireStudent(), z.string().uuid().parse(params.id), z.string().uuid().parse(params.questionId), await parseJson(req, answerSchema)),
);
