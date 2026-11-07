import "server-only";
import { randomUUID } from "node:crypto";
import { and, count, eq, inArray, lt } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { AppError, forbidden, notFound } from "@/lib/security/errors";
import type { Actor } from "@/lib/security/actor";
import { storage, storageDriverName } from ".";
import { DB_DRIVER_MAX_BYTES } from "./db.driver";

/** Per-file limit for this deployment (the DB driver is capped by Vercel's request size). */
export function uploadLimit(mime: AllowedMime) {
  return storageDriverName() === "db" ? Math.min(UPLOAD_LIMITS[mime], DB_DRIVER_MAX_BYTES) : UPLOAD_LIMITS[mime];
}

export const UPLOAD_LIMITS = {
  "image/jpeg": 10 * 1024 * 1024,
  "image/png": 10 * 1024 * 1024,
  "image/webp": 10 * 1024 * 1024,
  "application/pdf": 20 * 1024 * 1024,
} as const;
export type AllowedMime = keyof typeof UPLOAD_LIMITS;
const EXT: Record<AllowedMime, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };
const MAX_PENDING_PER_USER = 30;
export const MAX_FILES_PER_SUBMISSION = 10;

export const uploadRequestSchema = z.object({
  purpose: z.enum(["SUBMISSION", "ASSIGNMENT_ATTACHMENT"]),
  fileName: z.string().trim().min(1).max(200),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf"]),
  size: z.number().int().positive(),
});

/** Magic-byte check so a renamed file can't pass as an image/PDF. */
export function sniffMime(bytes: Uint8Array): AllowedMime | null {
  const b = bytes;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "application/pdf";
  return null;
}

export async function requestUpload(actor: Actor, input: z.infer<typeof uploadRequestSchema>) {
  if (input.purpose === "SUBMISSION" && actor.role !== "STUDENT") throw forbidden("Only students upload homework.");
  if (input.purpose === "ASSIGNMENT_ATTACHMENT" && actor.role !== "PARENT") throw forbidden("Only parents upload worksheets.");
  const limit = uploadLimit(input.mimeType);
  if (input.size > limit) throw new AppError("VALIDATION", `File is too large (max ${Math.round(limit / 1048576)} MB).`);
  const d = db();
  const [{ n }] = await d
    .select({ n: count() })
    .from(schema.uploads)
    .where(and(eq(schema.uploads.ownerUserId, actor.userId), eq(schema.uploads.status, "PENDING")));
  if (n >= MAX_PENDING_PER_USER) throw new AppError("RATE_LIMITED", "Too many unfinished uploads. Please finish or wait a little.");

  // Opaque key — never derived from the user's file name.
  const now = new Date();
  const key = `families/${actor.familyId}/${input.purpose.toLowerCase()}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}.${EXT[input.mimeType]}`;
  const [row] = await d
    .insert(schema.uploads)
    .values({
      familyId: actor.familyId,
      ownerUserId: actor.userId,
      purpose: input.purpose,
      storageKey: key,
      fileName: input.fileName.replace(/[\u0000-\u001f]/g, "").slice(0, 200),
      mimeType: input.mimeType,
      declaredSize: input.size,
    })
    .returning();
  const put = await storage().presignPut(key, { contentType: input.mimeType, contentLength: input.size, expiresIn: 600 });
  return { uploadId: row.id, upload: put };
}

/** Called after the browser PUTs the file: verifies size + signature bytes. */
export async function completeUpload(actor: Actor, uploadId: string) {
  const d = db();
  const [u] = await d.select().from(schema.uploads).where(eq(schema.uploads.id, uploadId));
  if (!u || u.ownerUserId !== actor.userId) throw notFound("Upload");
  if (u.status === "UPLOADED" || u.status === "ATTACHED") return { uploadId: u.id, fileName: u.fileName, mimeType: u.mimeType, size: u.sizeBytes ?? u.declaredSize };
  if (u.status !== "PENDING") throw new AppError("CONFLICT", "This upload is no longer valid.");
  const s = storage();
  const head = await s.head(u.storageKey);
  if (!head) throw new AppError("VALIDATION", "The file hasn't finished uploading.");
  const reject = async (msg: string) => {
    await s.delete(u.storageKey).catch(() => {});
    await d.update(schema.uploads).set({ status: "DELETED" }).where(eq(schema.uploads.id, u.id));
    throw new AppError("VALIDATION", msg);
  };
  if (head.size !== u.declaredSize || head.size > uploadLimit(u.mimeType as AllowedMime)) await reject("The uploaded file size doesn't match.");
  const sniffed = sniffMime(await s.getBytes(u.storageKey, { start: 0, end: 15 }));
  if (sniffed !== u.mimeType) await reject("That file doesn't look like a valid image or PDF.");
  await d.update(schema.uploads).set({ status: "UPLOADED", sizeBytes: head.size, verifiedAt: new Date() }).where(eq(schema.uploads.id, u.id));
  return { uploadId: u.id, fileName: u.fileName, mimeType: u.mimeType, size: head.size };
}

/** Short-lived download URL for a stored object the caller has already been authorised for. */
export async function signedViewUrl(storageKey: string, fileName?: string) {
  return storage().presignGet(storageKey, { expiresIn: 600, downloadName: fileName });
}

/** Removes uploads that were never attached (abandoned) after the retention window. */
export async function cleanupAbandonedUploads(limit = 100) {
  const d = db();
  const cutoff = new Date(Date.now() - env().UPLOAD_RETENTION_HOURS * 3600_000);
  const rows = await d
    .select({ id: schema.uploads.id, key: schema.uploads.storageKey })
    .from(schema.uploads)
    .where(and(inArray(schema.uploads.status, ["PENDING", "UPLOADED"]), lt(schema.uploads.createdAt, cutoff)))
    .limit(limit);
  for (const r of rows) {
    await storage().delete(r.key).catch(() => {});
    await d.update(schema.uploads).set({ status: "DELETED" }).where(eq(schema.uploads.id, r.id));
  }
  return rows.length;
}

/** Deletes stored objects for the given keys (used when submissions/accounts are deleted). */
export async function deleteObjects(keys: string[]) {
  for (const k of keys) await storage().delete(k).catch((e) => console.error("[storage] delete failed", k, e));
}
