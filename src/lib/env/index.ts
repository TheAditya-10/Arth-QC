import "server-only";
import { z } from "zod";

/**
 * Server environment. Validated lazily so `next build` works without secrets;
 * each integration checks for its own variables at call time.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url().optional(),
  BETTER_AUTH_SECRET: z.string().min(32).optional(),
  APP_URL: z.string().url().optional(),
  // AI
  AI_PROVIDER: z.enum(["gemini", "mock"]).default("gemini"),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL_EVALUATION: z.string().default("gemini-2.5-flash"),
  GEMINI_MODEL_EXTRACTION: z.string().default("gemini-2.5-flash"),
  GEMINI_MODEL_FAST: z.string().default("gemini-2.5-flash-lite"),
  // Storage
  STORAGE_DRIVER: z.enum(["r2", "local"]).optional(),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  // Email
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Arth-QC <reports@example.com>"),
  // Cron / workers
  CRON_SECRET: z.string().optional(),
  EVALUATION_BATCH_SIZE: z.coerce.number().int().min(1).max(20).default(3),
  BUDDY_HOURLY_LIMIT: z.coerce.number().int().min(1).default(30),
  BUDDY_DAILY_LIMIT: z.coerce.number().int().min(1).default(120),
  BUDDY_RETENTION_DAYS: z.coerce.number().int().min(1).default(30),
  UPLOAD_RETENTION_HOURS: z.coerce.number().int().min(1).default(24),
});

export type Env = z.infer<typeof schema>;
let cached: Env | null = null;

export function env(): Env {
  if (!cached) cached = schema.parse(process.env);
  return cached;
}

export function appUrl(): string {
  return env().APP_URL ?? process.env.VERCEL_PROJECT_PRODUCTION_URL?.replace(/^/, "https://") ?? "http://localhost:3000";
}

export function requireEnv<K extends keyof Env>(key: K): NonNullable<Env[K]> {
  const v = env()[key];
  if (v === undefined || v === null || v === "") throw new Error(`Missing required environment variable ${String(key)}`);
  return v as NonNullable<Env[K]>;
}
