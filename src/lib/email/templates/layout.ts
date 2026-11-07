/** Escape user/DB-provided text before interpolating into HTML. */
export function esc(s: string | number | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const C = { indigo: "#292B59", lavender: "#EEEAFE", sun: "#FFD66B", mint: "#BCEBD6", mintDark: "#1F7A55", coral: "#B54632", paper: "#FAF9F6", muted: "#5E6085" };

export const colors = C;

/** Table-based, inline-styled email shell (works in Gmail/Outlook). */
export function emailLayout(opts: { preheader: string; title: string; body: string; footer?: string }) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(opts.title)}</title></head>
<body style="margin:0;padding:0;background:${C.lavender};font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;color:${C.indigo}">
<span style="display:none;max-height:0;overflow:hidden">${esc(opts.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.lavender};padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:${C.indigo};padding:20px 24px">
<span style="display:inline-block;background:${C.sun};color:${C.indigo};font-weight:800;border-radius:8px;padding:4px 8px;font-size:14px">✓</span>
<span style="color:#fff;font-size:20px;font-weight:700;margin-left:8px;vertical-align:middle">Arth-QC</span>
</td></tr>
<tr><td style="padding:24px">${opts.body}</td></tr>
<tr><td style="padding:16px 24px;background:${C.paper};color:${C.muted};font-size:12px;line-height:1.5">${opts.footer ?? "You are receiving this because you are a parent on an Arth-QC family account."}</td></tr>
</table></td></tr></table></body></html>`;
}

export function button(href: string, label: string) {
  return `<a href="${esc(href)}" style="display:inline-block;background:${C.sun};color:${C.indigo};font-weight:700;text-decoration:none;padding:12px 20px;border-radius:12px">${esc(label)}</a>`;
}
