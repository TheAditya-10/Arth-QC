import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { handler, parseJson } from "@/lib/security/route";
import { rateLimit } from "@/lib/security/rate-limit";
import { registerSchema } from "@/lib/validation/account";
import { registerParent } from "@/lib/services/account.service";
import { clientIp } from "@/lib/security/request";

/** Parent registration: creates the user, a new family, then signs in. */
export const POST = handler(async (req) => {
  await rateLimit(`register:${clientIp(req)}`, 5, 3600, "Too many sign-up attempts. Try again later.");
  const input = await parseJson(req, registerSchema);
  await registerParent(input);
  const { headers } = await auth().api.signInEmail({
    body: { email: input.email, password: input.password },
    headers: req.headers,
    returnHeaders: true,
  });
  const res = NextResponse.json({ ok: true, redirectTo: "/parent" });
  headers.getSetCookie().forEach((c) => res.headers.append("set-cookie", c));
  return res;
});
