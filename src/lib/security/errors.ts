import { ZodError } from "zod";

export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "AI_UNAVAILABLE"
  | "BAD_REQUEST"
  | "ONBOARDING_REQUIRED"
  | "INTERNAL";

const STATUS: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 422,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  AI_UNAVAILABLE: 503,
  BAD_REQUEST: 400,
  ONBOARDING_REQUIRED: 409,
  INTERNAL: 500,
};

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: unknown,
    public retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "AppError";
  }
  get status() {
    return STATUS[this.code];
  }
}

export const unauthorized = (m = "Please sign in.") => new AppError("UNAUTHORIZED", m);
export const forbidden = (m = "You don't have access to this.") => new AppError("FORBIDDEN", m);
export const notFound = (what = "Resource") => new AppError("NOT_FOUND", `${what} not found.`);
export const conflict = (m: string) => new AppError("CONFLICT", m);
export const badRequest = (m: string, details?: unknown) => new AppError("BAD_REQUEST", m, details);

export interface ApiErrorBody {
  error: { code: ErrorCode; message: string; details?: unknown };
}

export function toErrorBody(err: unknown): { status: number; body: ApiErrorBody; headers?: Record<string, string> } {
  if (err instanceof AppError) {
    return {
      status: err.status,
      body: { error: { code: err.code, message: err.message, details: err.details } },
      headers: err.retryAfterSeconds ? { "Retry-After": String(err.retryAfterSeconds) } : undefined,
    };
  }
  if (err instanceof ZodError) {
    return {
      status: 422,
      body: {
        error: {
          code: "VALIDATION",
          message: "Some fields are invalid.",
          details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        },
      },
    };
  }
  console.error("[api] unhandled error", err);
  return { status: 500, body: { error: { code: "INTERNAL", message: "Something went wrong. Please try again." } } };
}
