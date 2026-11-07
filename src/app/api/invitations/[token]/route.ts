import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { handler, parseJson } from "@/lib/security/route";
import { rateLimit } from "@/lib/security/rate-limit";
import { clientIp } from "@/lib/security/request";
import { acceptInviteSchema } from "@/lib/validation/account";
import { acceptInvitation, getInvitation } from "@/lib/services/account.service";

export const GET = handler<{ token: string }>(async (req, { params }) => {
  await rateLimit(`invite-view:${clientIp(req)}`, 30, 3600);
  return getInvitation(params.token);
});

export const POST = handler<{ token: string }>(async (req, { params }) => {
  await rateLimit(`invite-accept:${clientIp(req)}`, 10, 3600);
  const body = await parseJson(req, acceptInviteSchema.omit({ token: true }));
  const session = await auth().api.getSession({ headers: req.headers });
  const result = await acceptInvitation({ token: params.token, ...body }, session?.user.id ?? null);
  const res = NextResponse.json({ ok: true, redirectTo: "/parent" });
  if (result.isNewUser && body.password) {
    const { headers } = await auth().api.signInEmail({ body: { email: result.email, password: body.password }, headers: req.headers, returnHeaders: true });
    headers.getSetCookie().forEach((c) => res.headers.append("set-cookie", c));
  }
  return res;
});
