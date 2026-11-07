import { handler, parseJson } from "@/lib/security/route";
import { requireStudent } from "@/lib/security/actor";
import { buddyMessageSchema, clearMessages, listMessages, sendMessage } from "@/lib/services/buddy.service";

export const maxDuration = 60;

export const GET = handler(async () => listMessages(await requireStudent()));
export const POST = handler(async (req) => {
  const actor = await requireStudent();
  const { text } = await parseJson(req, buddyMessageSchema);
  const reply = await sendMessage(actor, text);
  return { id: reply.id, role: "buddy", text: reply.content, at: reply.createdAt.toISOString() };
});
export const DELETE = handler(async () => {
  await clearMessages(await requireStudent());
  return { ok: true };
});
