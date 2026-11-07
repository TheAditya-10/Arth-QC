import "server-only";
import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { AppError } from "./errors";

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Compared in constant time. */
export function assertCron(req: NextRequest) {
  const secret = env().CRON_SECRET;
  if (!secret) throw new AppError("FORBIDDEN", "CRON_SECRET is not configured.");
  const header = req.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const got = Buffer.from(header);
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) throw new AppError("UNAUTHORIZED", "Invalid cron credentials.");
}
