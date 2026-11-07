import "server-only";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { appUrl } from "@/lib/env";
import type { StorageDriver } from "./driver";
import { makeLocalToken } from "./local.driver";

/**
 * Stores objects in Postgres (bytea). Presigned semantics match R2: the browser
 * PUTs/GETs through /api/storage/db with a short-lived HMAC-signed token.
 * Vercel limits request bodies to 4.5 MB, so uploads are capped at 4 MB per file.
 */
export const DB_DRIVER_MAX_BYTES = 4 * 1024 * 1024;

export async function writeDbObject(key: string, bytes: Uint8Array, contentType: string) {
  const data = Buffer.from(bytes);
  await db()
    .insert(schema.storedObjects)
    .values({ key, contentType, size: data.byteLength, data })
    .onConflictDoUpdate({ target: schema.storedObjects.key, set: { contentType, size: data.byteLength, data } });
}

export async function readDbObject(key: string) {
  const [row] = await db().select().from(schema.storedObjects).where(eq(schema.storedObjects.key, key));
  return row ?? null;
}

export function createDbDriver(): StorageDriver {
  const base = () => `${appUrl()}/api/storage/db`;
  return {
    name: "db",
    async presignPut(key, { contentType, contentLength, expiresIn }) {
      const exp = Date.now() + expiresIn * 1000;
      const token = makeLocalToken({ key, op: "put", exp, type: contentType, len: contentLength });
      return { url: `${base()}?token=${token}`, method: "PUT", headers: { "Content-Type": contentType }, expiresAt: new Date(exp).toISOString() };
    },
    async presignGet(key, { expiresIn }) {
      return `${base()}?token=${makeLocalToken({ key, op: "get", exp: Date.now() + expiresIn * 1000 })}`;
    },
    async head(key) {
      const [row] = await db()
        .select({ size: schema.storedObjects.size, contentType: schema.storedObjects.contentType })
        .from(schema.storedObjects)
        .where(eq(schema.storedObjects.key, key));
      return row ?? null;
    },
    async getBytes(key, range) {
      if (range) {
        const r = await db().execute<{ chunk: Buffer }>(
          sql`select substring(${schema.storedObjects.data} from ${range.start + 1} for ${range.end - range.start + 1}) as chunk from ${schema.storedObjects} where ${schema.storedObjects.key} = ${key}`,
        );
        const chunk = r.rows[0]?.chunk;
        if (!chunk) throw new Error("Object not found");
        return new Uint8Array(chunk);
      }
      const row = await readDbObject(key);
      if (!row) throw new Error("Object not found");
      return new Uint8Array(row.data);
    },
    async delete(key) {
      await db().delete(schema.storedObjects).where(eq(schema.storedObjects.key, key));
    },
  };
}
