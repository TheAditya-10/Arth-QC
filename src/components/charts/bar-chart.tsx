"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART, axisProps } from "./chart-theme";
import { ChartTooltip } from "./chart-tooltip";

/** Single-series vertical bar chart. Optionally highlights one bar (e.g. today). */
export function SimpleBarChart({
  data,
  height = 200,
  unit = "",
  name = "Value",
  highlightIndex,
  domain,
}: {
  data: { label: string; value: number }[];
  height?: number;
  unit?: string;
  name?: string;
  highlightIndex?: number;
  domain?: [number, number];
}) {
  return (
    <div style={{ height }} role="img" aria-label={`${name}: ${data.map((d) => `${d.label} ${d.value}${unit}`).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke={CHART.grid} />
          <XAxis dataKey="label" {...axisProps} />
          <YAxis {...axisProps} width={44} domain={domain} tickFormatter={(v) => `${v}${unit}`} />
          <Tooltip content={<ChartTooltip unit={unit} name={name} />} cursor={{ fill: "rgba(41,43,89,0.05)" }} />
          <Bar dataKey="value" name={name} radius={[4, 4, 0, 0]} maxBarSize={36} animationDuration={800}>
            {data.map((_, i) => (
              <Cell key={i} fill={highlightIndex === undefined || highlightIndex === i ? CHART.ink : CHART.inkSoft} fillOpacity={highlightIndex === undefined || highlightIndex === i ? 1 : 0.45} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal bars for topic scores — labels on the left, value tooltip. */
export function TopicBarChart({ data, height }: { data: { topic: string; score: number }[]; height?: number }) {
  const h = height ?? Math.max(160, data.length * 40);
  return (
    <div style={{ height: h }} role="img" aria-label={`Topic accuracy: ${data.map((d) => `${d.topic} ${d.score}%`).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }} barCategoryGap="30%">
          <CartesianGrid horizontal={false} stroke={CHART.grid} />
          <XAxis type="number" domain={[0, 100]} {...axisProps} tickFormatter={(v) => `${v}%`} />
          <YAxis type="category" dataKey="topic" {...axisProps} width={150} tick={{ fill: CHART.ink, fontSize: 12 }} />
          <Tooltip content={<ChartTooltip unit="%" name="Accuracy" />} cursor={{ fill: "rgba(41,43,89,0.05)" }} />
          <Bar dataKey="score" name="Accuracy" radius={[0, 4, 4, 0]} maxBarSize={18} fill={CHART.ink} animationDuration={800} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
