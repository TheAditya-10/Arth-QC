import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { appUrl, requireEnv } from "@/lib/env";
import type { StorageDriver } from "./driver";

/**
 * Development-only driver: files live under .data/uploads and are served through
 * /api/storage/local with short-lived HMAC-signed tokens (same semantics as R2 presigning).
 */
const ROOT = path.join(process.cwd(), ".data", "uploads");

function sign(payload: string) {
  return createHmac("sha256", requireEnv("BETTER_AUTH_SECRET")).update(payload).digest("base64url");
}

export function makeLocalToken(p: { key: string; op: "put" | "get"; exp: number; type?: string; len?: number }) {
  const payload = Buffer.from(JSON.stringify(p)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyLocalToken(token: string): { key: string; op: "put" | "get"; exp: number; type?: string; len?: number } | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(payload));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const data = JSON.parse(Buffer.from(payload, "base64url").toString());
  if (typeof data.exp !== "number" || data.exp < Date.now()) return null;
  return data;
}

export function localPath(key: string) {
  const p = path.normalize(path.join(ROOT, key));
  if (!p.startsWith(ROOT + path.sep)) throw new Error("Invalid storage key");
  return p;
}

export async function writeLocal(key: string, bytes: Uint8Array, contentType: string) {
  const p = localPath(key);
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, bytes);
  await writeFile(`${p}.meta`, JSON.stringify({ contentType }));
}

export function createLocalDriver(): StorageDriver {
  const base = `${appUrl()}/api/storage/local`;
  return {
    name: "local",
    async presignPut(key, { contentType, contentLength, expiresIn }) {
      const exp = Date.now() + expiresIn * 1000;
      const token = makeLocalToken({ key, op: "put", exp, type: contentType, len: contentLength });
      return { url: `${base}?token=${token}`, method: "PUT", headers: { "Content-Type": contentType }, expiresAt: new Date(exp).toISOString() };
    },
    async presignGet(key, { expiresIn }) {
      return `${base}?token=${makeLocalToken({ key, op: "get", exp: Date.now() + expiresIn * 1000 })}`;
    },
    async head(key) {
      try {
        const s = await stat(localPath(key));
        const meta = JSON.parse(await readFile(`${localPath(key)}.meta`, "utf8").catch(() => "{}"));
        return { size: s.size, contentType: meta.contentType ?? null };
      } catch {
        return null;
      }
    },
    async getBytes(key, range) {
      const buf = await readFile(localPath(key));
      return new Uint8Array(range ? buf.subarray(range.start, range.end + 1) : buf);
    },
    async delete(key) {
      await rm(localPath(key), { force: true });
      await rm(`${localPath(key)}.meta`, { force: true });
    },
  };
}
