"use client";

import { motion } from "framer-motion";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { TopicProgress } from "@/types";
import { cn } from "@/lib/utils";

export function masteryTone(m: number) {
  if (m >= 80) return { bar: "bg-mint-dark", label: "Mastered", text: "text-mint-dark" };
  if (m >= 60) return { bar: "bg-indigo", label: "Getting there", text: "text-indigo" };
  if (m > 0) return { bar: "bg-coral", label: "Needs practice", text: "text-coral-dark" };
  return { bar: "bg-muted", label: "Not started", text: "text-muted-foreground" };
}

export function TopicProgressList({ topics, limit }: { topics: TopicProgress[]; limit?: number }) {
  const list = limit ? topics.slice(0, limit) : topics;
  return (
    <ul className="space-y-4">
      {list.map((t, i) => {
        const tone = masteryTone(t.mastery);
        const Trend = t.trend === "up" ? TrendingUp : t.trend === "down" ? TrendingDown : Minus;
        return (
          <li key={t.topicId}>
            <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate font-semibold">{t.topicName}</span>
              <span className="flex shrink-0 items-center gap-2">
                <span className={cn("hidden text-xs font-semibold sm:inline", tone.text)}>{tone.label}</span>
                <span className="w-10 text-right font-heading font-bold">{t.mastery}%</span>
                <Trend className={cn("h-3.5 w-3.5", t.trend === "up" ? "text-mint-dark" : t.trend === "down" ? "text-coral-dark" : "text-muted-foreground")} aria-label={`trend ${t.trend}`} />
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-muted">
              <motion.div
                className={cn("h-full rounded-full", tone.bar)}
                initial={{ width: 0 }}
                animate={{ width: `${t.mastery}%` }}
                transition={{ duration: 0.9, delay: i * 0.06, ease: "easeOut" }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
