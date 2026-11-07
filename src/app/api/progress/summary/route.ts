import { handler } from "@/lib/security/route";
import { requireParent, resolveStudentId } from "@/lib/security/actor";
import { parentDashboard } from "@/lib/services/dashboard.service";

export const dynamic = "force-dynamic";

export const GET = handler(async (req) => {
  const actor = await requireParent();
  return parentDashboard(actor, await resolveStudentId(actor, req.nextUrl.searchParams.get("studentId")));
});
