import type { z } from "zod/v4";

export type AIPurpose = "extraction" | "rubric" | "evaluation" | "feedback" | "generation" | "practice" | "judge" | "buddy";

export type AIPart = { text: string } | { inlineData: { mimeType: string; data: string } } | { fileData: { mimeType: string; fileUri: string } };

export interface AIFile {
  mimeType: string;
  bytes: Uint8Array;
  name: string;
}

export interface AIJsonRequest<S extends z.ZodType> {
  purpose: AIPurpose;
  model: string;
  promptVersion: string;
  system: string;
  parts: AIPart[];
  schema: S;
  temperature?: number;
  referenceId?: string;
  /** Structured context — only used by the offline mock provider. */
  mockContext?: unknown;
}

export interface AITextRequest {
  purpose: AIPurpose;
  model: string;
  promptVersion: string;
  system: string;
  history: { role: "user" | "model"; text: string }[];
  temperature?: number;
  maxOutputTokens?: number;
  referenceId?: string;
  mockContext?: unknown;
}

export interface AIResult<T> {
  data: T;
  model: string;
}

export type AIErrorKind = "not_configured" | "rate_limited" | "quota_exhausted" | "unavailable" | "invalid_response" | "bad_request" | "blocked";

export class AIError extends Error {
  constructor(
    public kind: AIErrorKind,
    message: string,
    public retryAfterMs?: number,
  ) {
    super(message);
    this.name = "AIError";
  }
  /** Whether a background job should try again later. */
  get retryable() {
    return this.kind === "rate_limited" || this.kind === "quota_exhausted" || this.kind === "unavailable" || this.kind === "invalid_response";
  }
}

/** Replaceable model backend (Gemini today; swap models or vendors via env). */
export interface AIProvider {
  readonly name: string;
  generateJson<S extends z.ZodType>(req: AIJsonRequest<S>): Promise<AIResult<z.infer<S>>>;
  generateText(req: AITextRequest): Promise<AIResult<string>>;
  /** Turn files into model input parts (inline for small payloads, uploaded otherwise). */
  filesToParts(files: AIFile[]): Promise<AIPart[]>;
}
