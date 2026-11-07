import "server-only";
import { and, eq } from "drizzle-orm";
import { schema, type DbOrTx } from "@/lib/db";
import { badRequest } from "@/lib/security/errors";

export async function resolveSubject(tx: DbOrTx, code: string) {
  const [s] = await tx.select().from(schema.subjects).where(eq(schema.subjects.code, code));
  if (!s) throw badRequest(`Unknown subject "${code}".`);
  if (!s.enabled) throw badRequest(`${s.name} is not available yet.`);
  return s;
}

/** Topics are addressed by stable codes (e.g. "fractions") in the API. */
export async function resolveTopic(tx: DbOrTx, subjectId: string, code: string, grade: number) {
  const [t] = await tx
    .select()
    .from(schema.topics)
    .where(and(eq(schema.topics.subjectId, subjectId), eq(schema.topics.code, code), eq(schema.topics.grade, grade)));
  if (t) return t;
  // Fall back to any grade for the same topic code (curriculum overlap).
  const [any] = await tx.select().from(schema.topics).where(and(eq(schema.topics.subjectId, subjectId), eq(schema.topics.code, code)));
  if (!any) throw badRequest(`Unknown topic "${code}".`);
  return any;
}

export const toDbDifficulty = (d: "easy" | "medium" | "hard") => d.toUpperCase() as "EASY" | "MEDIUM" | "HARD";
export const fromDbDifficulty = (d: "EASY" | "MEDIUM" | "HARD") => d.toLowerCase() as "easy" | "medium" | "hard";
