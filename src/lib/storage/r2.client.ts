import "server-only";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requireEnv } from "@/lib/env";
import type { StorageDriver } from "./driver";

/** Cloudflare R2 (S3-compatible). The bucket must be private — no public access. */
export function createR2Driver(): StorageDriver {
  const accountId = requireEnv("R2_ACCOUNT_ID");
  const bucket = requireEnv("R2_BUCKET");
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: requireEnv("R2_ACCESS_KEY_ID"), secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY") },
  });
  return {
    name: "r2",
    async presignPut(key, { contentType, contentLength, expiresIn }) {
      // ContentLength + ContentType are signed, so R2 rejects any other size/type.
      const cmd = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType, ContentLength: contentLength });
      const url = await getSignedUrl(client, cmd, { expiresIn, signableHeaders: new Set(["content-type", "content-length"]) });
      return { url, method: "PUT", headers: { "Content-Type": contentType }, expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString() };
    },
    async presignGet(key, { expiresIn, downloadName }) {
      const cmd = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        ResponseContentDisposition: downloadName ? `inline; filename="${downloadName.replace(/[^\w.\- ]/g, "_")}"` : undefined,
      });
      return getSignedUrl(client, cmd, { expiresIn });
    },
    async head(key) {
      try {
        const r = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return { size: Number(r.ContentLength ?? 0), contentType: r.ContentType ?? null };
      } catch (e) {
        if ((e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) return null;
        throw e;
      }
    },
    async getBytes(key, range) {
      const r = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key, Range: range ? `bytes=${range.start}-${range.end}` : undefined }));
      return new Uint8Array(await r.Body!.transformToByteArray());
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
}
