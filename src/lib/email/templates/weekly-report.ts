import type { WeeklyReportData } from "@/lib/services/report.types";
import { button, colors as C, emailLayout, esc } from "./layout";

function bar(label: string, value: number, max = 100) {
  const w = Math.max(2, Math.min(100, Math.round((value / max) * 100)));
  return `<tr><td style="padding:4px 0;font-size:13px;width:45%">${esc(label)}</td>
<td style="padding:4px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="background:${C.indigo};height:10px;border-radius:5px;width:${w}%"></td><td style="background:#E4E3F4;height:10px;border-radius:5px"></td></tr></table></td>
<td style="padding:4px 0 4px 8px;font-size:13px;font-weight:700;width:48px;text-align:right">${esc(value)}${max === 100 ? "%" : ""}</td></tr>`;
}

function tile(label: string, value: string) {
  return `<td style="padding:6px" width="25%"><div style="background:${C.paper};border-radius:12px;padding:12px">
<div style="font-size:20px;font-weight:800">${esc(value)}</div><div style="font-size:12px;color:${C.muted}">${esc(label)}</div></div></td>`;
}

export function weeklyReportEmail(p: { data: WeeklyReportData; weekStart: string; weekEnd: string; link: string; includeTopics: boolean; includeMistakes: boolean; isTest?: boolean }) {
  const d = p.data;
  const delta = d.averageScore && d.previousAverageScore ? d.averageScore - d.previousAverageScore : null;
  const deltaHtml =
    delta === null
      ? ""
      : `<p style="margin:8px 0 0;font-size:14px;color:${delta >= 0 ? C.mintDark : C.coral};font-weight:700">${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta)} points vs last week (${d.previousAverageScore}%)</p>`;
  const minutesMax = Math.max(30, ...d.dailyMinutes.map((x) => x.minutes));
  const body = `
${p.isTest ? `<p style="background:${C.sun};padding:8px 12px;border-radius:8px;font-size:13px;margin:0 0 16px">Test report — this is a preview of the weekly email.</p>` : ""}
<h1 style="font-size:22px;margin:0">${esc(d.studentName)}'s week in maths</h1>
<p style="margin:4px 0 16px;color:${C.muted};font-size:14px">${esc(p.weekStart)} – ${esc(p.weekEnd)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
${tile("Average score", d.averageScore ? `${d.averageScore}%` : "—")}${tile("Assignments", `${d.assignmentsCompleted}/${Math.max(d.assignmentsAssigned, d.assignmentsCompleted)}`)}${tile("Study days", `${d.studyDays}/7`)}${tile("Minutes", String(d.studyMinutes))}
</tr></table>
${deltaHtml}
${p.includeTopics && d.topicScores.length ? `<h2 style="font-size:16px;margin:20px 0 8px">Topic-wise performance</h2><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${d.topicScores.map((t) => bar(t.topic, t.score)).join("")}</table>` : ""}
<h2 style="font-size:16px;margin:20px 0 8px">Study consistency</h2>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${d.dailyMinutes.map((x) => bar(x.day, x.minutes, minutesMax)).join("")}</table>
${p.includeMistakes ? `<p style="font-size:14px;margin:16px 0 0"><b>Mistakes corrected:</b> ${d.mistakesCorrected}</p>` : ""}
${d.achievementsUnlocked.length ? `<p style="font-size:14px;margin:8px 0 0"><b>Badges unlocked:</b> ${d.achievementsUnlocked.map(esc).join(", ")}</p>` : ""}
${d.weakConcepts.length ? `<h2 style="font-size:16px;margin:20px 0 8px">Concepts that need attention</h2><ul style="margin:0;padding-left:18px;font-size:14px;line-height:1.6">${d.weakConcepts.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>` : ""}
<h2 style="font-size:16px;margin:20px 0 8px">Recommended focus for next week</h2>
<ul style="margin:0;padding-left:18px;font-size:14px;line-height:1.6">${(d.recommendations.length ? d.recommendations.map((r) => `<li><b>${esc(r.topic)}</b> — ${esc(r.reason)}</li>`) : ["<li>Keep up the steady practice!</li>"]).join("")}</ul>
<p style="margin:24px 0 0">${button(p.link, "Open the full report")}</p>`;
  return {
    subject: `${p.isTest ? "[Test] " : ""}${d.studentName}'s weekly maths report (${p.weekStart} – ${p.weekEnd})`,
    html: emailLayout({ preheader: `${d.studentName}: ${d.assignmentsCompleted} assignments, ${d.studyDays} study days this week`, title: "Weekly report", body }),
    text: `${d.studentName}'s week (${p.weekStart} – ${p.weekEnd}): average ${d.averageScore}%, ${d.assignmentsCompleted} assignments, ${d.studyDays} study days, ${d.studyMinutes} minutes. Open: ${p.link}`,
  };
}
