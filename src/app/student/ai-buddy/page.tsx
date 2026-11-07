"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Eraser, Lightbulb, SendHorizonal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Mascot } from "@/components/shared/mascot";
import { PageSkeleton } from "@/components/shared/states";
import { useChat, useStudent } from "@/hooks/use-data";
import { buddyService } from "@/lib/client";
import { cn, initials } from "@/lib/utils";

/** Renders **bold** segments and line breaks from scripted buddy replies. */
function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => (
        <p key={i} className={cn(line === "" ? "h-2" : "")}>
          {line.split(/(\*\*[^*]+\*\*)/).map((seg, j) =>
            seg.startsWith("**") ? <strong key={j}>{seg.slice(2, -2)}</strong> : <span key={j}>{seg}</span>,
          )}
        </p>
      ))}
    </>
  );
}

export default function AIBuddyPage() {
  const chat = useChat();
  const student = useStudent();
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chat?.length, typing]);

  if (!chat || !student) return <PageSkeleton cards={0} />;

  const send = async (msg: string) => {
    const t = msg.trim();
    if (!t || typing) return;
    setText("");
    setTyping(true);
    try {
      await buddyService.sendBuddyMessage(t);
    } finally {
      setTyping(false);
    }
  };

  return (
    <div className="mx-auto flex h-[calc(100dvh-4rem-5.5rem-1.25rem)] max-w-3xl flex-col lg:h-[calc(100dvh-4rem-3rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-soft">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-lavender">
          <Mascot className="h-12 w-12" mood={typing ? "thinking" : "happy"} />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-lg font-bold leading-tight">Arthu · AI Buddy</h1>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-mint-dark" /> Hints first, answers never handed out
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => buddyService.clearChat()} aria-label="Start a new chat">
          <Eraser /> <span className="hidden sm:inline">New chat</span>
        </Button>
      </div>

      {/* Messages */}
      <div className="scrollbar-none mt-3 flex-1 space-y-3 overflow-y-auto px-1 py-2" aria-live="polite">
        <AnimatePresence initial={false}>
          {chat.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={cn("flex items-end gap-2", m.role === "student" && "flex-row-reverse")}
            >
              {m.role === "buddy" ? (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lavender"><Mascot className="h-7 w-7" animate={false} /></div>
              ) : (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sun text-xs font-bold">{initials(student.name)}</div>
              )}
              <div
                className={cn(
                  "max-w-[82%] space-y-0.5 rounded-2xl px-4 py-3 text-[15px] leading-relaxed shadow-soft",
                  m.role === "buddy" ? "rounded-bl-md bg-card" : "rounded-br-md bg-indigo text-white",
                )}
              >
                <RichText text={m.text} />
              </div>
            </motion.div>
          ))}
          {typing && (
            <motion.div key="typing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-end gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-lavender"><Mascot className="h-7 w-7" animate={false} mood="thinking" /></div>
              <div className="flex gap-1 rounded-2xl rounded-bl-md bg-card px-4 py-4 shadow-soft" aria-label="Arthu is typing">
                {[0, 1, 2].map((i) => (
                  <motion.span key={i} className="h-2 w-2 rounded-full bg-indigo-300" animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={endRef} />
      </div>

      {/* Suggestions */}
      <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-2 pt-1">
        {buddyService.SUGGESTED_PROMPTS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => send(p)}
            disabled={typing}
            className="flex shrink-0 items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm font-medium text-indigo-500 transition hover:border-indigo-300 hover:text-indigo disabled:opacity-50"
          >
            <Lightbulb className="h-3.5 w-3.5 text-sun-dark" /> {p}
          </button>
        ))}
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
        className="flex items-center gap-2 rounded-2xl border bg-card p-2 shadow-soft"
      >
        <label htmlFor="buddy-input" className="sr-only">Message Arthu</label>
        <input
          id="buddy-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask a question or type your answer…"
          className="h-11 flex-1 bg-transparent px-3 text-[15px] outline-none placeholder:text-muted-foreground"
          autoComplete="off"
          maxLength={300}
        />
        <Button type="submit" size="icon" className="h-11 w-11 rounded-xl" disabled={!text.trim() || typing} aria-label="Send">
          <SendHorizonal className="h-5 w-5" />
        </Button>
      </form>
    </div>
  );
}
