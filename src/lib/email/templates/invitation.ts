import { button, emailLayout, esc } from "./layout";

export function invitationEmail(p: { inviterName: string; familyName: string; link: string; expiresInDays: number }) {
  const body = `<h1 style="font-size:22px;margin:0 0 12px">You're invited to ${esc(p.familyName)}</h1>
<p style="font-size:15px;line-height:1.6;margin:0 0 16px">${esc(p.inviterName)} invited you to join their family on Arth-QC, where you can assign homework, review evaluations and follow your child's progress.</p>
<p style="margin:0 0 20px">${button(p.link, "Accept invitation")}</p>
<p style="font-size:13px;color:#5E6085;margin:0">This link expires in ${p.expiresInDays} days. If you weren't expecting it, you can ignore this email.</p>`;
  return {
    subject: `${p.inviterName} invited you to Arth-QC`,
    html: emailLayout({ preheader: `Join ${p.familyName} on Arth-QC`, title: "Arth-QC invitation", body }),
    text: `${p.inviterName} invited you to join ${p.familyName} on Arth-QC. Accept: ${p.link} (expires in ${p.expiresInDays} days)`,
  };
}
