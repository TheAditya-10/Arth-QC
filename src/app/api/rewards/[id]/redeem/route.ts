import { z } from "zod";
import { handler } from "@/lib/security/route";
import { requireStudent } from "@/lib/security/actor";
import { requestRedemption } from "@/lib/services/reward.service";

export const POST = handler<{ id: string }>(async (_req, { params }) => requestRedemption(await requireStudent(), z.string().uuid().parse(params.id)));
