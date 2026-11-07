import "server-only";
import { Resend } from "resend";
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "@/lib/env";

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Idempotency key so provider-side retries don't double-send (Resend only). */
  idempotencyKey?: string;
}

export type SendEmailResult =
  | { status: "SENT"; providerMessageId: string | null }
  | { status: "SKIPPED"; reason: string }
  | { status: "FAILED"; error: string; retryable: boolean };

let resend: Resend | null = null;
let smtp: Transporter | null = null;

function smtpTransport(): Transporter {
  if (smtp) return smtp;
  const e = env();
  const secure = e.SMTP_SECURE ? e.SMTP_SECURE === "true" : e.SMTP_PORT === 465;
  smtp = nodemailer.createTransport({
    host: e.SMTP_HOST,
    port: e.SMTP_PORT,
    secure,
    requireTLS: !secure,
    auth: e.SMTP_USER ? { user: e.SMTP_USER, pass: e.SMTP_PASS } : undefined,
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return smtp;
}

/**
 * Sends an email via SMTP (if SMTP_HOST is set) or Resend (if RESEND_API_KEY is set).
 * Without either (local dev) the email is skipped and logged.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const { SMTP_HOST, RESEND_API_KEY, EMAIL_FROM } = env();
  if (SMTP_HOST) {
    try {
      const info = await smtpTransport().sendMail({ from: EMAIL_FROM, to: input.to, subject: input.subject, html: input.html, text: input.text });
      return { status: "SENT", providerMessageId: info.messageId ?? null };
    } catch (e) {
      const err = e as { responseCode?: number; message?: string };
      // 5xx = permanent (bad address/auth); network errors and 4xx are worth retrying.
      const retryable = !(err.responseCode && err.responseCode >= 500 && err.responseCode < 600);
      return { status: "FAILED", error: `SMTP: ${err.message ?? String(e)}`.slice(0, 500), retryable };
    }
  }
  if (!RESEND_API_KEY) {
    console.info(`[email] no email provider configured — skipped "${input.subject}" to ${input.to}`);
    return { status: "SKIPPED", reason: "Email provider not configured" };
  }
  resend = resend ?? new Resend(RESEND_API_KEY);
  try {
    const { data, error } = await resend.emails.send(
      { from: EMAIL_FROM, to: input.to, subject: input.subject, html: input.html, text: input.text },
      input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined,
    );
    if (error) {
      const retryable = !/validation|invalid/i.test(error.name ?? "");
      return { status: "FAILED", error: `${error.name}: ${error.message}`, retryable };
    }
    return { status: "SENT", providerMessageId: data?.id ?? null };
  } catch (e) {
    return { status: "FAILED", error: e instanceof Error ? e.message : String(e), retryable: true };
  }
}
