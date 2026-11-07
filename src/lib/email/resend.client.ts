import "server-only";
import { Resend } from "resend";
import { env } from "@/lib/env";

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Idempotency key so provider-side retries don't double-send. */
  idempotencyKey?: string;
}

export type SendEmailResult =
  | { status: "SENT"; providerMessageId: string | null }
  | { status: "SKIPPED"; reason: string }
  | { status: "FAILED"; error: string; retryable: boolean };

let client: Resend | null = null;

/** Sends via Resend. Without RESEND_API_KEY (local dev) the email is skipped and logged. */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const { RESEND_API_KEY, EMAIL_FROM } = env();
  if (!RESEND_API_KEY) {
    console.info(`[email] RESEND_API_KEY not set — skipped "${input.subject}" to ${input.to}`);
    return { status: "SKIPPED", reason: "Email provider not configured" };
  }
  client = client ?? new Resend(RESEND_API_KEY);
  try {
    const { data, error } = await client.emails.send(
      { from: EMAIL_FROM, to: input.to, subject: input.subject, html: input.html, text: input.text },
      input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined,
    );
    if (error) {
      const retryable = !/validation|invalid/i.test(error.name ?? "") ;
      return { status: "FAILED", error: `${error.name}: ${error.message}`, retryable };
    }
    return { status: "SENT", providerMessageId: data?.id ?? null };
  } catch (e) {
    return { status: "FAILED", error: e instanceof Error ? e.message : String(e), retryable: true };
  }
}
