import "server-only";
import { sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { AppError } from "./errors";

/**
 * Fixed-window counter stored in Postgres, so limits hold across serverless instances.
 * Single atomic upsert per check.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number, message = "You're doing that too often. Please wait a bit.") {
  const t = schema.apiRateLimits;
  const result = await db().execute<{ count: number; window_start: string }>(sql`
    insert into ${t} (key, window_start, count) values (${key}, now(), 1)
    on conflict (key) do update set
      count = case when ${t.windowStart} < now() - (${windowSeconds} * interval '1 second') then 1 else ${t.count} + 1 end,
      window_start = case when ${t.windowStart} < now() - (${windowSeconds} * interval '1 second') then now() else ${t.windowStart} end
    returning count, window_start
  `);
  const row = result.rows[0];
  if (row && Number(row.count) > limit) {
    const elapsed = (Date.now() - new Date(row.window_start).getTime()) / 1000;
    throw new AppError("RATE_LIMITED", message, undefined, Math.max(1, Math.ceil(windowSeconds - elapsed)));
  }
}
