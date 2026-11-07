"use client";

/** Typed fetch wrapper for our route handlers. Throws ApiClientError with the server's message. */
export class ApiClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export async function api<T = unknown>(method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new ApiClientError("You seem to be offline. Check your internet connection and try again.", 0, "NETWORK");
  }
  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) {
    const err = (data as { error?: { message?: string; code?: string; details?: unknown }; message?: string } | null) ?? null;
    if (res.status === 401 && typeof window !== "undefined" && !path.startsWith("/api/auth")) {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    }
    throw new ApiClientError(err?.error?.message ?? err?.message ?? `Request failed (${res.status})`, res.status, err?.error?.code, err?.error?.details);
  }
  return data as T;
}

function safeJson(t: string) {
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

export function errorMessage(e: unknown, fallback = "Something went wrong. Please try again.") {
  return e instanceof Error && e.message ? e.message : fallback;
}

/** Random idempotency key for retry-safe POSTs. */
export function idempotencyKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
