"use client";

import type { ChatMessage } from "@/types";
import { api } from "./api";
import { refresh, setDB } from "./store";

export const SUGGESTED_PROMPTS = [
  "Explain fractions simply",
  "Give me a hint for 36/48 in simplest form",
  "Why was my last answer wrong?",
  "Give me a similar practice question",
  "What is HCF?",
  "Just tell me the answer!",
];

export async function sendBuddyMessage(text: string): Promise<ChatMessage> {
  const temp: ChatMessage = { id: `local-${Date.now()}`, role: "student", text, at: new Date().toISOString() };
  setDB((db) => ({ ...db, chat: [...db.chat, temp] }));
  try {
    const reply = await api<ChatMessage>("POST", "/api/buddy/messages", { text });
    setDB((db) => ({ ...db, chat: [...db.chat, reply] }));
    return reply;
  } catch (e) {
    setDB((db) => ({ ...db, chat: db.chat.filter((m) => m.id !== temp.id) }));
    throw e;
  }
}

export async function clearChat() {
  await api("DELETE", "/api/buddy/messages");
  await refresh();
}
