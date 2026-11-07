"use client";

import { addDays, dayKey, formatDate, startOfWeek } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** GitHub-style study calendar for the last N weeks. Darker = more minutes. */
export function ConsistencyCalendar({ minutes, weeks = 6 }: { minutes: Record<string, number>; weeks?: number }) {
  const start = addDays(startOfWeek(), -7 * (weeks - 1));
  const today = dayKey();
  const level = (m: number) => (m <= 0 ? 0 : m < 25 ? 1 : m < 40 ? 2 : 3);
  const shades = ["bg-muted", "bg-mint", "bg-[#6FCBA2]", "bg-mint-dark"];
  return (
    <div>
      <div className="grid grid-cols-[auto_repeat(7,minmax(0,1fr))] gap-1.5 text-[11px]">
        <span />
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i} className="text-center font-semibold text-muted-foreground">{d}</span>
        ))}
        {Array.from({ length: weeks }).map((_, w) => (
          <div key={w} className="contents">
            <span className="pr-1 text-right text-muted-foreground">{formatDate(addDays(start, w * 7).toISOString())}</span>
            {Array.from({ length: 7 }).map((_, d) => {
              const date = addDays(start, w * 7 + d);
              const key = dayKey(date);
              const m = minutes[key] ?? 0;
              const future = key > today;
              return (
                <Tooltip key={d}>
                  <TooltipTrigger asChild>
                    <span
                      tabIndex={0}
                      className={cn(
                        "aspect-square rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        future ? "bg-muted/40" : shades[level(m)],
                        key === today && "ring-2 ring-indigo ring-offset-1",
                      )}
                      aria-label={`${formatDate(date.toISOString(), { weekday: "short", day: "numeric", month: "short" })}: ${m} minutes`}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    {formatDate(date.toISOString(), { weekday: "short", day: "numeric", month: "short" })} · {future ? "upcoming" : m ? `${m} min` : "no study"}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground">
        Less {shades.map((s) => <span key={s} className={cn("h-3 w-3 rounded", s)} />)} More
      </div>
    </div>
  );
}
