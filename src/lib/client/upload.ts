"use client";

import { api, ApiClientError } from "./api";

export interface PresignResponse {
  uploadId: string;
  upload: { url: string; method: "PUT"; headers: Record<string, string>; expiresAt: string };
}

/** Uploads one file directly to private storage via a presigned URL, reporting progress. */
export async function uploadFile(file: File, purpose: "SUBMISSION" | "ASSIGNMENT_ATTACHMENT", onProgress?: (fraction: number) => void): Promise<string> {
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
