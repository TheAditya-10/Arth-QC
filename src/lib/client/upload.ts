"use client";

import { api, ApiClientError } from "./api";

export interface PresignResponse {
  uploadId: string;
  upload: { url: string; method: "PUT"; headers: Record<string, string>; expiresAt: string };
}

const COMPRESS_ABOVE = 1.5 * 1024 * 1024;
const TARGET_MAX = 3.8 * 1024 * 1024;
const MAX_SIDE = 2400;

/**
 * Downscales large photos (phone cameras produce 5–12 MB) to ≤2400px JPEG.
 * Handwriting stays legible, uploads are faster and fit the server's per-file limit.
 */
export async function prepareImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= COMPRESS_ABOVE) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    for (const q of [0.88, 0.8, 0.7, 0.6]) {
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", q));
      if (blob && (blob.size <= TARGET_MAX || q === 0.6)) {
        return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
      }
    }
  } catch {
    /* fall back to the original file */
  }
  return file;
}

/** Uploads one file directly to private storage via a presigned URL, reporting progress. */
export async function uploadFile(original: File, purpose: "SUBMISSION" | "ASSIGNMENT_ATTACHMENT", onProgress?: (fraction: number) => void): Promise<string> {
  const file = await prepareImage(original);
  const mimeType = file.type === "image/jpg" ? "image/jpeg" : file.type;
  const { uploadId, upload } = await api<PresignResponse>("POST", "/api/uploads", { purpose, fileName: file.name, mimeType, size: file.size });
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", upload.url);
    Object.entries(upload.headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new ApiClientError(`Upload failed (${xhr.status}). Please try again.`, xhr.status)));
    xhr.onerror = () => reject(new ApiClientError("Upload failed — check your connection and try again.", 0));
    xhr.send(file);
  });
  await api("POST", `/api/uploads/${uploadId}/complete`);
  onProgress?.(1);
  return uploadId;
}
