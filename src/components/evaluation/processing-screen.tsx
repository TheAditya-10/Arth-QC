"use client";

import { motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { Mascot } from "@/components/shared/mascot";
import { EVALUATION_STAGES } from "@/lib/client/submission.service";
import { usePauseCelebrations } from "@/components/shared/celebration";
import { cn } from "@/lib/utils";

export function ProcessingScreen({ stage, title }: { stage: number; title: string }) {
  usePauseCelebrations();
  const progress = Math.round((Math.min(stage, EVALUATION_STAGES.length) / EVALUATION_STAGES.length) * 100);
  return (
    <div className="mx-auto max-w-lg py-6 text-center" role="status" aria-live="polite">
      <div className="relative mx-auto h-36 w-36">
        <motion.div
          className="absolute inset-0 rounded-full border-4 border-dashed border-indigo-200"
          animate={{ rotate: 360 }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        />
        <div className="absolute inset-3 flex items-center justify-center rounded-full bg-lavender">
          <Mascot mood="thinking" className="h-24 w-24" />
        </div>
      </div>
      <h1 className="mt-6 font-heading text-2xl font-bold">Arthu is checking your work…</h1>
      <p className="mt-1 text-muted-foreground">{title}</p>

      <div className="mt-6 h-2.5 overflow-hidden rounded-full bg-muted">
        <motion.div className="h-full rounded-full bg-indigo" animate={{ width: `${progress}%` }} transition={{ duration: 0.6 }} />
      </div>

      <ol className="mt-6 space-y-2.5 text-left">
        {EVALUATION_STAGES.map((s, i) => {
          const done = i < stage;
          const active = i === stage;
          return (
            <motion.li
              key={s.key}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className={cn(
                "flex items-center gap-3 rounded-2xl border p-3.5 transition-colors",
                done && "border-mint bg-mint-light/60",
                active && "border-indigo-200 bg-card shadow-soft",
                !done && !active && "bg-card/50 opacity-60",
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-heading font-bold",
                  done ? "bg-mint-dark text-white" : active ? "bg-indigo text-white" : "bg-muted text-indigo-300",
                )}
              >
                {done ? <Check className="h-5 w-5" strokeWidth={3} /> : active ? <Loader2 className="h-5 w-5 animate-spin" /> : i + 1}
              </span>
              <div>
                <p className="font-semibold">{s.label}</p>
                {active && <p className="text-sm text-muted-foreground">{s.detail}</p>}
              </div>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}
