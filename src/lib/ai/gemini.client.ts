import "server-only";
import { ApiError, GoogleGenAI, HarmBlockThreshold, HarmCategory, type Content } from "@google/genai";
import type { z } from "zod/v4";
import { db, schema } from "@/lib/db";
import { requireEnv } from "@/lib/env";
import { toGeminiSchema } from "./schemas";
import { AIError, type AIFile, type AIJsonRequest, type AIPart, type AIProvider, type AIResult, type AITextRequest } from "./provider";

/** Gemini accepts ~20 MB of inline data per request; larger payloads go through the Files API. */
const INLINE_LIMIT_BYTES = 15 * 1024 * 1024;

const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 1500;

const SAFETY = [
  HarmCategory.HARM_CATEGORY_HARASSMENT,
  HarmCategory.HARM_CATEGORY_HATE_SPEECH,
  HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
  HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
].map((category) => ({ category, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE }));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Classify SDK errors into retry decisions. */
export function classifyGeminiError(e: unknown): AIError {
  if (e instanceof AIError) return e;
  if (e instanceof ApiError) {
    const msg = e.message ?? "";
    const retryMatch = /retryDelay"?:\s*"?(\d+(?:\.\d+)?)s/.exec(msg);
    const retryAfterMs = retryMatch ? Math.ceil(Number(retryMatch[1]) * 1000) : undefined;
    if (e.status === 429) {
      // Daily / project quota exhaustion is not worth retrying within this request.
      if (/per.?day|daily|quota.*exceeded|exceeded.*quota|billing/i.test(msg)) return new AIError("quota_exhausted", "Gemini quota exhausted.", retryAfterMs ?? 60 * 60_000);
      return new AIError("rate_limited", "Gemini rate limit hit.", retryAfterMs);
    }
    if (e.status === 400) return new AIError("bad_request", `Gemini rejected the request: ${msg.slice(0, 300)}`);
    if (e.status === 401 || e.status === 403) return new AIError("not_configured", "Gemini API key is invalid or lacks access.");
    if (e.status === 404) return new AIError("unavailable", `Model not available: ${msg.slice(0, 200)}`);
    if (e.status >= 500) return new AIError("unavailable", `Gemini is temporarily unavailable (${e.status}).`);
  }
  const m = e instanceof Error ? e.message : String(e);
  if (/fetch failed|ECONNRESET|ETIMEDOUT|network|socket/i.test(m)) return new AIError("unavailable", `Network error calling Gemini: ${m}`);
  return new AIError("unavailable", m);
}

async function logUsage(entry: {
  purpose: string;
  model: string;
  promptVersion: string;
  status: string;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  error?: string;
  referenceId?: string;
}) {
  try {
    await db().insert(schema.aiUsageLogs).values(entry);
  } catch (e) {
    console.error("[ai] failed to log usage", e);
  }
}

export function createGeminiProvider(): AIProvider {
  const ai = new GoogleGenAI({ apiKey: requireEnv("GEMINI_API_KEY") });

  async function withRetry<T>(label: { purpose: string; model: string; promptVersion: string; referenceId?: string }, fn: () => Promise<T>): Promise<T> {
    let lastErr: AIError | null = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const started = Date.now();
      try {
        const out = await fn();
        return out;
      } catch (e) {
        lastErr = classifyGeminiError(e);
        await logUsage({ ...label, status: lastErr.kind, latencyMs: Date.now() - started, error: lastErr.message.slice(0, 500) });
        const transient = lastErr.kind === "rate_limited" || lastErr.kind === "unavailable";
        if (!transient || attempt === MAX_ATTEMPTS) throw lastErr;
        // Exponential backoff with jitter; honour server-provided retry delay when short.
        const backoff = BASE_DELAY_MS * 2 ** (attempt - 1) + Math.random() * 500;
        const wait = lastErr.retryAfterMs && lastErr.retryAfterMs < 20_000 ? lastErr.retryAfterMs : backoff;
        if (wait > 20_000) throw lastErr;
        await sleep(wait);
      }
    }
    throw lastErr ?? new AIError("unavailable", "Unknown AI error");
  }

  return {
    name: "gemini",
    async generateJson<S extends z.ZodType>(req: AIJsonRequest<S>): Promise<AIResult<z.infer<S>>> {
      const label = { purpose: req.purpose, model: req.model, promptVersion: req.promptVersion, referenceId: req.referenceId };
      let parts = req.parts;
      // One repair round if the model returns JSON that fails schema validation.
      for (let round = 0; round < 2; round++) {
        const started = Date.now();
        const res = await withRetry(label, () =>
          ai.models.generateContent({
            model: req.model,
            contents: [{ role: "user", parts }],
            config: {
              systemInstruction: req.system,
              temperature: req.temperature ?? 0.1,
              responseMimeType: "application/json",
              responseJsonSchema: toGeminiSchema(req.schema),
              safetySettings: SAFETY,
            },
          }),
        );
        const usage = res.usageMetadata;
        const text = res.text ?? "";
        if (!text) {
          const reason = res.candidates?.[0]?.finishReason ?? res.promptFeedback?.blockReason ?? "empty";
          await logUsage({ ...label, status: "blocked", latencyMs: Date.now() - started, error: String(reason) });
          throw new AIError(String(reason).includes("SAFETY") ? "blocked" : "invalid_response", `Gemini returned no content (${reason}).`);
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = undefined;
        }
        const result = parsed === undefined ? null : req.schema.safeParse(parsed);
        if (result?.success) {
          await logUsage({ ...label, status: "ok", latencyMs: Date.now() - started, inputTokens: usage?.promptTokenCount, outputTokens: usage?.candidatesTokenCount });
          return { data: result.data, model: req.model };
        }
        const problem = result ? JSON.stringify(result.error.issues.slice(0, 8)) : "Response was not valid JSON.";
        await logUsage({ ...label, status: "invalid_response", latencyMs: Date.now() - started, error: problem.slice(0, 500) });
        parts = [...req.parts, { text: `Your previous response failed validation: ${problem}\nReturn corrected JSON that matches the schema exactly.` }];
      }
      throw new AIError("invalid_response", "Gemini returned output that failed validation twice.");
    },

    async filesToParts(files: AIFile[]): Promise<AIPart[]> {
      const total = files.reduce((s, f) => s + f.bytes.byteLength, 0);
      if (total <= INLINE_LIMIT_BYTES) {
        return files.map((f) => ({ inlineData: { mimeType: f.mimeType, data: Buffer.from(f.bytes).toString("base64") } }));
      }
      const parts: AIPart[] = [];
      for (const f of files) {
        const uploaded = await withRetry({ purpose: "extraction", model: "files-api", promptVersion: "-" }, () =>
          ai.files.upload({ file: new Blob([Buffer.from(f.bytes)], { type: f.mimeType }), config: { mimeType: f.mimeType, displayName: f.name } }),
        );
        if (!uploaded.uri) throw new AIError("unavailable", "File upload to Gemini failed.");
        parts.push({ fileData: { mimeType: f.mimeType, fileUri: uploaded.uri } });
      }
      return parts;
    },

    async generateText(req: AITextRequest): Promise<AIResult<string>> {
      const label = { purpose: req.purpose, model: req.model, promptVersion: req.promptVersion, referenceId: req.referenceId };
      const started = Date.now();
      const contents: Content[] = req.history.map((m) => ({ role: m.role, parts: [{ text: m.text }] }));
      const res = await withRetry(label, () =>
        ai.models.generateContent({
          model: req.model,
          contents,
          config: { systemInstruction: req.system, temperature: req.temperature ?? 0.6, maxOutputTokens: req.maxOutputTokens ?? 600, safetySettings: SAFETY },
        }),
      );
      const text = res.text?.trim();
      if (!text) {
        await logUsage({ ...label, status: "blocked", latencyMs: Date.now() - started });
        throw new AIError("blocked", "No reply generated.");
      }
      await logUsage({ ...label, status: "ok", latencyMs: Date.now() - started, inputTokens: res.usageMetadata?.promptTokenCount, outputTokens: res.usageMetadata?.candidatesTokenCount });
      return { data: text, model: req.model };
    },
  };
}
