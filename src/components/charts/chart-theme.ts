/** Shared chart tokens — single-hue (brand indigo) marks, recessive axes and grid. */
export const CHART = {
  ink: "#292B59",
  inkSoft: "#6C6CB0",
  grid: "#E4E3F4",
  axis: "#8887B8",
  mint: "#1F7A55",
  sun: "#B98A12",
  coral: "#B54632",
  font: 12,
};

export const axisProps = {
  stroke: CHART.axis,
  tick: { fill: CHART.axis, fontSize: CHART.font },
  tickLine: false,
  axisLine: false,
} as const;
