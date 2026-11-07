"use client";

import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";
import { CHART } from "./chart-theme";
import { ChartTooltip } from "./chart-tooltip";

export function TopicRadar({ data, height = 280 }: { data: { topic: string; score: number }[]; height?: number }) {
  return (
    <div style={{ height }} role="img" aria-label={`Topic mastery radar: ${data.map((d) => `${d.topic} ${d.score}%`).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke={CHART.grid} />
          <PolarAngleAxis dataKey="topic" tick={{ fill: CHART.ink, fontSize: 11 }} />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Tooltip content={<ChartTooltip unit="%" name="Mastery" />} />
          <Radar dataKey="score" name="Mastery" stroke={CHART.ink} strokeWidth={2} fill={CHART.ink} fillOpacity={0.15} dot={{ r: 3, fill: CHART.ink }} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
