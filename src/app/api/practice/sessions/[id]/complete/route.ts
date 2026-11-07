import { z } from "zod";
import { handler } from "@/lib/security/route";
import { requireStudent } from "@/lib/security/actor";
import { completeSession } from "@/lib/services/practice.service";

export const POST = handler<{ id: string }>(async (_req, { params }) => completeSession(await requireStudent(), z.string().uuid().parse(params.id)));
