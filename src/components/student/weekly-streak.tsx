"use client";

import { motion } from "framer-motion";
import { Check, Flame } from "lucide-react";
import { addDays, dayKey, startOfWeek, WEEKDAYS_SHORT } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function WeeklyStreak({ studyDays, streak }: { studyDays: string[]; streak: number }) {
  const start = startOfWeek();
  const today = dayKey();
  const set = new Set(studyDays);
  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {WEEKDAYS_SHORT.map((d, i) => {
          const key = dayKey(addDays(start, i));
          const done = set.has(key);
          const isToday = key === today;
          const future = key > today;
          return (
            <div key={d} className="flex flex-col items-center gap-1.5">
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: i * 0.05, type: "spring", stiffness: 300, damping: 18 }}
                className={cn(
                  "flex aspect-square w-full max-w-[44px] items-center justify-center rounded-xl border-2 text-sm font-bold",
                  done && "border-transparent bg-coral text-white",
                  !done && isToday && "border-dashed border-coral bg-coral-light/50 text-coral-dark",
                  !done && !isToday && !future && "border-transparent bg-muted text-indigo-300",
                  future && "border-transparent bg-muted/50 text-indigo-200",
                )}
                aria-label={`${d}: ${done ? "studied" : isToday ? "today, not yet" : future ? "upcoming" : "missed"}`}
              >
                {done ? <Check className="h-4 w-4" strokeWidth={3} /> : isToday ? <Flame className="h-4 w-4" /> : null}
              </motion.div>
              <span className={cn("text-[11px] font-semibold", isToday ? "text-indigo" : "text-muted-foreground")}>{d}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        {set.has(today) ? (
          <>You studied today — your streak is <b className="text-coral-dark">{streak} days</b>! 🔥</>
        ) : (
          <>Study today to grow your <b className="text-coral-dark">{streak}-day</b> streak!</>
        )}
      </p>
    </div>
  );
}
