"use client";

import { useId } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART, axisProps } from "./chart-theme";
import { ChartTooltip } from "./chart-tooltip";

export function ScoreTrendChart({
  data,
  height = 220,
  unit = "%",
  name = "Score",
  domain = [0, 100],
}: {
  data: { label: string; score: number }[];
  height?: number;
  unit?: string;
  name?: string;
  domain?: [number, number];
}) {
  const gid = `fill-${useId().replace(/:/g, "")}`;
  return (
    <div style={{ height }} role="img" aria-label={`${name} over time: ${data.map((d) => `${d.label} ${d.score}${unit}`).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART.ink} stopOpacity={0.18} />
              <stop offset="100%" stopColor={CHART.ink} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={CHART.grid} />
          <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" />
          <YAxis domain={domain} {...axisProps} width={44} tickFormatter={(v) => `${v}${unit}`} />
          <Tooltip content={<ChartTooltip unit={unit} name={name} />} cursor={{ stroke: CHART.inkSoft, strokeDasharray: 4 }} />
          <Area
            type="monotone"
            dataKey="score"
            name={name}
            stroke={CHART.ink}
            strokeWidth={2}
            fill={`url(#${gid})`}
            dot={{ r: 4, fill: "#fff", stroke: CHART.ink, strokeWidth: 2 }}
            activeDot={{ r: 6, fill: CHART.ink, stroke: "#fff", strokeWidth: 2 }}
            animationDuration={900}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
