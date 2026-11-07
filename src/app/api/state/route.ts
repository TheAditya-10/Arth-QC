import { handler } from "@/lib/security/route";
import { requireActor } from "@/lib/security/actor";
import { buildState } from "@/lib/services/state.service";

export const dynamic = "force-dynamic";

/** Snapshot of everything the signed-in user's screens need (server-authorised). */
export const GET = handler(async (req) => {
  const actor = await requireActor();
  const res = await buildState(actor, req.nextUrl.searchParams.get("studentId"));
  return Response.json(res, { headers: { "Cache-Control": "private, no-store" } });
});
