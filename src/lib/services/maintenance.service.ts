import "server-only";
import { lt } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export async function maintenanceSweep() {
  const d = db();
  const rl = await d.delete(schema.apiRateLimits).where(lt(schema.apiRateLimits.windowStart, new Date(Date.now() - 2 * 86400_000))).returning({ k: schema.apiRateLimits.key });
  const sessions = await d.delete(schema.sessions).where(lt(schema.sessions.expiresAt, new Date())).returning({ id: schema.sessions.id });
  const logs = await d.delete(schema.aiUsageLogs).where(lt(schema.aiUsageLogs.createdAt, new Date(Date.now() - 90 * 86400_000))).returning({ id: schema.aiUsageLogs.id });
  return { rateLimitRowsDeleted: rl.length, expiredSessionsDeleted: sessions.length, oldAiLogsDeleted: logs.length };
}
