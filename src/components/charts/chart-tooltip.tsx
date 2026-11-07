"use client";

import type { TooltipProps } from "recharts";

/** Compact tooltip used across all charts. */
export function ChartTooltip({
  active,
  payload,
  label,
  unit = "",
  name,
}: TooltipProps<number, string> & { unit?: string; name?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-foreground">{label ?? payload[0].payload?.label}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="mt-0.5 text-muted-foreground">
          {name ?? p.name}: <span className="font-semibold text-foreground">{p.value}{unit}</span>
        </p>
      ))}
    </div>
  );
}
