import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import type { ZodType, ZodTypeDef } from "zod";
import { trustedOrigins } from "@/lib/env";
import { AppError, toErrorBody } from "./errors";

type Ctx<P> = { params: Promise<P> };

/**
 * Wraps a route handler with: centralised error handling, typed JSON responses
 * and an Origin check on state-changing requests (CSRF defence in depth on top
 * of SameSite=Lax session cookies).
 */
export function handler<P = Record<string, string>, R = unknown>(fn: (req: NextRequest, ctx: { params: P }) => Promise<R>) {
  return async (req: NextRequest, ctx: Ctx<P>) => {
    try {
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) assertSameOrigin(req);
      const result = await fn(req, { params: await ctx.params });
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (err) {
      const { status, body, headers } = toErrorBody(err);
      return NextResponse.json(body, { status, headers });
    }
  };
}

function assertSameOrigin(req: NextRequest) {
  // Cron/worker requests authenticate with a bearer secret instead.
  if (req.headers.get("authorization")?.startsWith("Bearer ")) return;
  const origin = req.headers.get("origin");
  const allowed = new Set(trustedOrigins());
  if (!origin || !allowed.has(origin)) throw new AppError("FORBIDDEN", "Cross-site request blocked.");
}

export async function parseJson<T>(req: NextRequest, schema: ZodType<T, ZodTypeDef, unknown>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new AppError("BAD_REQUEST", "Request body must be valid JSON.");
  }
  return schema.parse(raw);
}

export function parseQuery<T>(req: NextRequest, schema: ZodType<T, ZodTypeDef, unknown>): T {
  return schema.parse(Object.fromEntries(req.nextUrl.searchParams));
}
