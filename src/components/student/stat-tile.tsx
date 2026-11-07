"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const tones = {
  coral: "bg-coral-light text-coral-dark",
  sun: "bg-sun-light text-sun-dark",
  mint: "bg-mint-light text-mint-dark",
  lavender: "bg-lavender text-indigo",
} as const;

export function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  tone = "lavender",
  delay = 0,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: keyof typeof tones;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="rounded-2xl border bg-card p-4 shadow-soft"
    >
      <div className={cn("mb-3 flex h-9 w-9 items-center justify-center rounded-xl", tones[tone])}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="font-heading text-2xl font-bold leading-none sm:text-[28px]">{value}</p>
      <p className="mt-1.5 text-sm font-medium text-muted-foreground">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-indigo-400">{hint}</p>}
    </motion.div>
  );
}
