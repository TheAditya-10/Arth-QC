import "server-only";
import { and, desc, eq, lt } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import type { Actor } from "@/lib/security/actor";
import { rateLimit } from "@/lib/security/rate-limit";
import { aiProvider, models, AIError } from "@/lib/ai";
import { BUDDY_SYSTEM, HINT_LEVEL_GUIDANCE, PROMPT_VERSIONS } from "@/lib/ai/prompts";
import { recommendationsFor } from "./progress";

export const buddyMessageSchema = z.object({ text: z.string().trim().min(1).max(500) });

const HISTORY_TURNS = 12;

/** Remove personal data before storing or sending to the model. */
export function redactPII(text: string): { text: string; redacted: boolean } {
  let redacted = false;
  const out = text
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, () => ((redacted = true), "[email removed]"))
    .replace(/(?:\+?\d[\s-]?){10,13}/g, (m) => (m.replace(/\D/g, "").length >= 10 ? ((redacted = true), "[number removed]") : m));
  return { text: out, redacted };
}

export async function listMessages(actor: Actor & { studentProfileId: string }) {
  const rows = await db()
    .select()
    .from(schema.buddyMessages)
    .where(eq(schema.buddyMessages.studentProfileId, actor.studentProfileId))
    .orderBy(desc(schema.buddyMessages.createdAt))
    .limit(60);
  return rows.reverse();
}

export async function sendMessage(actor: Actor & { studentProfileId: string }, raw: string) {
  const e = env();
  await rateLimit(`buddy:h:${actor.studentProfileId}`, e.BUDDY_HOURLY_LIMIT, 3600, "Arthu needs a short break! Try again in a little while, or keep practising.");
  await rateLimit(`buddy:d:${actor.studentProfileId}`, e.BUDDY_DAILY_LIMIT, 86400, "That's a lot of questions today — Arthu will be back tomorrow!");
  const d = db();
  const { text, redacted } = redactPII(raw);
  await d.insert(schema.buddyMessages).values({ studentProfileId: actor.studentProfileId, role: "STUDENT", content: text, flagged: redacted });

  const history = (
    await d
      .select({ role: schema.buddyMessages.role, content: schema.buddyMessages.content })
      .from(schema.buddyMessages)
      .where(eq(schema.buddyMessages.studentProfileId, actor.studentProfileId))
      .orderBy(desc(schema.buddyMessages.createdAt))
      .limit(HISTORY_TURNS)
  ).reverse();

  const [profile] = await d.select().from(schema.studentProfiles).where(eq(schema.studentProfiles.id, actor.studentProfileId));
  const [prefs] = await d.select({ app: schema.notificationPreferences.appPreferences }).from(schema.notificationPreferences).where(eq(schema.notificationPreferences.userId, actor.userId));
  const mistakes = await d
    .select({ q: schema.mistakeNotebook.questionText, s: schema.mistakeNotebook.studentAnswer, e: schema.mistakeNotebook.explanation, t: schema.mistakeNotebook.mistakeType })
    .from(schema.mistakeNotebook)
    .where(and(eq(schema.mistakeNotebook.studentProfileId, actor.studentProfileId), eq(schema.mistakeNotebook.status, "OPEN")))
    .orderBy(desc(schema.mistakeNotebook.createdAt))
    .limit(3);
  const recs = (await recommendationsFor(d, actor.studentProfileId, profile.grade)).slice(0, 2);
  const hintLevel = prefs?.app.aiHintLevel ?? "gentle";
  const context = [
    `Student: Class ${profile.grade}, first name ${profile.displayName.split(" ")[0]}.`,
    `Hint style: ${HINT_LEVEL_GUIDANCE[hintLevel]}`,
    recs.length ? `Topics to strengthen: ${recs.map((r) => `${r.topicName} (${r.reason})`).join("; ")}.` : "",
    mistakes.length
      ? `Recent mistakes the student may ask about:\n${mistakes.map((m) => `- Question: ${m.q}\n  They wrote: ${m.s || "(blank)"}\n  Issue: ${m.t ?? "error"} — ${m.e}`).join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  let reply: string;
  let model = "fallback";
  try {
    const res = await aiProvider().generateText({
      purpose: "buddy",
      model: models().fast,
      promptVersion: PROMPT_VERSIONS.buddy,
      system: `${BUDDY_SYSTEM}\n\nContext (do not read this out verbatim):\n${context}`,
      history: history.map((m) => ({ role: m.role === "STUDENT" ? "user" : "model", text: m.content })),
      temperature: 0.6,
      maxOutputTokens: 500,
      referenceId: actor.studentProfileId,
    });
    reply = res.data.slice(0, 1500);
    model = res.model;
  } catch (err) {
    const kind = err instanceof AIError ? err.kind : "unavailable";
    reply =
      kind === "blocked"
        ? "Let's keep our chat about learning! 😊 Ask me about a maths topic, a homework question, or a mistake you'd like to understand."
        : "Hmm, my thinking cap is taking a short rest. 🦉 Try again in a minute — meanwhile, have a go at the question yourself and tell me your first step!";
  }
  const [saved] = await d.insert(schema.buddyMessages).values({ studentProfileId: actor.studentProfileId, role: "BUDDY", content: reply, model }).returning();
  return saved;
}

export async function clearMessages(actor: Actor & { studentProfileId: string }) {
  await db().delete(schema.buddyMessages).where(eq(schema.buddyMessages.studentProfileId, actor.studentProfileId));
}

/** Retention: chat history older than BUDDY_RETENTION_DAYS is deleted. */
export async function purgeOldMessages() {
  const cutoff = new Date(Date.now() - env().BUDDY_RETENTION_DAYS * 86400_000);
  const r = await db().delete(schema.buddyMessages).where(lt(schema.buddyMessages.createdAt, cutoff)).returning({ id: schema.buddyMessages.id });
  return r.length;
}

