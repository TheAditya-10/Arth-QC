import "server-only";
import { env } from "@/lib/env";
import { createGeminiProvider } from "./gemini.client";
import { createMockProvider } from "./mock.provider";
import { AIError, type AIProvider } from "./provider";

let provider: AIProvider | null = null;

/** Active AI backend. The mock provider is for local development and tests only. */
export function aiProvider(): AIProvider {
  if (provider) return provider;
  const e = env();
  if (e.AI_PROVIDER === "mock") {
    if (e.NODE_ENV === "production" && !process.env.ALLOW_MOCK_AI) throw new AIError("not_configured", "The mock AI provider cannot be used in production.");
    provider = createMockProvider();
  } else {
    if (!e.GEMINI_API_KEY) throw new AIError("not_configured", "GEMINI_API_KEY is not configured.");
    provider = createGeminiProvider();
  }
  return provider;
}

/** Model names are configuration, so models can be upgraded without code changes. */
export function models() {
  const e = env();
  return { extraction: e.GEMINI_MODEL_EXTRACTION, evaluation: e.GEMINI_MODEL_EVALUATION, fast: e.GEMINI_MODEL_FAST };
}

export { AIError } from "./provider";
