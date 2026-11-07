import "server-only";
import { schema, type DbOrTx } from "@/lib/db";

export async function audit(
  tx: DbOrTx,
  e: { familyId?: string | null; actorUserId?: string | null; action: string; entityType: string; entityId?: string | null; details?: Record<string, unknown> },
) {
  await tx.insert(schema.auditLogs).values({
    familyId: e.familyId ?? null,
    actorUserId: e.actorUserId ?? null,
    action: e.action,
    entityType: e.entityType,
    entityId: e.entityId ?? null,
    details: e.details ?? {},
  });
}
