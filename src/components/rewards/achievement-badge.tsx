"use client";

import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import type { Achievement } from "@/types";
import { achievementIcon } from "@/components/shared/icons";
import { cn, formatDate } from "@/lib/utils";

const categoryTone: Record<Achievement["category"], string> = {
  consistency: "bg-coral text-white",
  improvement: "bg-mint text-mint-dark",
  accuracy: "bg-sun text-indigo",
  mastery: "bg-indigo text-sun",
  milestone: "bg-lavender-dark text-indigo",
};

export function AchievementBadge({ a, size = "md", index = 0 }: { a: Achievement; size?: "sm" | "md"; index?: number }) {
  const Icon = achievementIcon(a.icon);
  const unlocked = Boolean(a.unlockedAt);
  const pctDone = Math.round((a.current / a.target) * 100);
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.04 }}
      whileHover={unlocked ? { y: -3, rotate: -1 } : undefined}
      className={cn("flex flex-col items-center rounded-2xl border bg-card text-center shadow-soft", size === "md" ? "p-4" : "p-3")}
    >
      <div
        className={cn(
          "relative flex items-center justify-center rounded-2xl",
          size === "md" ? "h-16 w-16" : "h-12 w-12",
          unlocked ? categoryTone[a.category] : "bg-muted text-indigo-300",
        )}
      >
        <Icon className={size === "md" ? "h-8 w-8" : "h-6 w-6"} strokeWidth={2.2} />
        {!unlocked && (
          <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-card bg-indigo-200 text-indigo">
            <Lock className="h-3 w-3" />
          </span>
        )}
      </div>
      <p className={cn("mt-3 font-heading font-semibold leading-tight", size === "sm" && "text-sm")}>{a.title}</p>
      {size === "md" && <p className="mt-1 text-xs text-muted-foreground">{a.description}</p>}
      {unlocked ? (
        <p className="mt-2 text-[11px] font-semibold text-mint-dark">Unlocked {formatDate(a.unlockedAt!)}</p>
      ) : (
        <div className="mt-2 w-full">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-indigo" style={{ width: `${pctDone}%` }} />
          </div>
          <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
            {a.current}/{a.target}
          </p>
        </div>
      )}
    </motion.div>
  );
}
