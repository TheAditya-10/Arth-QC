/**
 * Generates an SVG "notebook page" data URL used as a mock preview for
 * handwritten homework submissions.
 */
export function notebookPage(lines: string[], opts: { title?: string; tint?: string } = {}): string {
  const width = 600;
  const height = 800;
  const lineGap = 38;
  const top = 110;
  const tint = opts.tint ?? "#2F4AA8";
  const ruled = Array.from({ length: 18 })
    .map((_, i) => `<line x1="0" x2="${width}" y1="${top + i * lineGap}" y2="${top + i * lineGap}" stroke="#C9D7EE" stroke-width="1.2"/>`)
    .join("");
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const text = lines
    .slice(0, 17)
    .map((l, i) => {
      const rot = ((i * 37) % 5) * 0.15 - 0.3;
      return `<text x="${l.startsWith("  ") ? 110 : 84}" y="${top + i * lineGap - 9}" transform="rotate(${rot} 300 ${top + i * lineGap})" font-family="'Segoe Print','Bradley Hand','Comic Sans MS',cursive" font-size="21" fill="${tint}">${esc(l.trim())}</text>`;
    })
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#FFFEF8"/>${ruled}<line x1="70" x2="70" y1="0" y2="${height}" stroke="#F2A7A0" stroke-width="2"/>${
    opts.title
      ? `<text x="84" y="60" font-family="'Segoe Print','Bradley Hand','Comic Sans MS',cursive" font-size="24" fill="${tint}" text-decoration="underline">${esc(opts.title)}</text>`
      : ""
  }${text}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
