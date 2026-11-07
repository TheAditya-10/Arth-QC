import { z } from "zod";
import { handler } from "@/lib/security/route";
import { requireActor } from "@/lib/security/actor";
import { completeUpload } from "@/lib/storage/upload.service";

/** Step 2: after the browser uploads directly to storage, verify and record it. */
export const POST = handler<{ id: string }>(async (_req, { params }) => completeUpload(await requireActor(), z.string().uuid().parse(params.id)));
