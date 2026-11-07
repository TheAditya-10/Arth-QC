import { z } from "zod";
import { handler } from "@/lib/security/route";
import { requireParent } from "@/lib/security/actor";
import { retryReport } from "@/lib/services/report.service";

export const POST = handler<{ id: string }>(async (_req, { params }) => retryReport(await requireParent(), z.string().uuid().parse(params.id)));
