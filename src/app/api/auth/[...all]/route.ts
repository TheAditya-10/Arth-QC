import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

// Better Auth endpoints: sign-in (email / username), sign-out, session.
export const GET = (req: NextRequest) => auth().handler(req);
export const POST = (req: NextRequest) => auth().handler(req);
