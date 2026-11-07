"use client";

import { useMemo, useState } from "react";
import { Download, Eye, History, Loader2, Mail, RefreshCw, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { errorMessage } from "@/lib/client/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/states";
import { ReportView } from "@/components/parent/report-view";
import { useWholeDB } from "@/hooks/use-data";
import { reportService } from "@/lib/client";
import type { ReportSettings } from "@/types";
import { formatDate, formatDateTime, initials } from "@/lib/utils";

export default function ReportsPage() {
  const db = useWholeDB();
  const [weekId, setWeekId] = useState("current");
  const [preview, setPreview] = useState(false);
  const [sending, setSending] = useState(false);

  const reports = useMemo(() => (db ? [reportService.buildCurrentWeekReport(db), ...db.pastReports] : []), [db]);
  const trend = useMemo(() => [...reports].reverse().map((r) => ({ label: formatDate(r.weekStart), score: r.averageScore })), [reports]);

  if (!db) return <PageSkeleton />;
  const report = reports.find((r) => r.id === weekId) ?? reports[0];
  const settings = db.reportSettings;
  const enabledRecipients = settings.recipients.filter((r) => r.enabled);

  const update = async (patch: Partial<ReportSettings>, msg = "Report settings saved") => {
    await reportService.updateReportSettings(patch);
    toast.success(msg);
  };

  const sendTest = async () => {
    setSending(true);
    try {
      const res = await reportService.sendTestReport();
      const skipped = res.results.filter((r) => r.status === "SKIPPED");
      const failed = res.results.filter((r) => r.status === "FAILED");
      if (failed.length) toast.error("Some test emails failed", { description: failed.map((f) => f.email).join(", ") });
      else if (skipped.length) toast.warning("Email isn't configured on this server", { description: "Set RESEND_API_KEY to send real emails. The report was generated successfully." });
      else toast.success("Test report sent", { description: `Delivered to ${res.sentTo.join(", ")}.` });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reports"
        title="Weekly reports"
        description="A summary of the week, delivered to both parents."
        actions={
          <>
            <Select value={weekId} onValueChange={setWeekId}>
              <SelectTrigger className="w-56" aria-label="Choose week"><SelectValue /></SelectTrigger>
              <SelectContent>
                {reports.map((r, i) => (
                  <SelectItem key={r.id} value={r.id}>{i === 0 ? "This week" : `Week of ${formatDate(r.weekStart)}`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => setPreview(true)}><Eye /> Preview email</Button>
            <Button variant="outline" onClick={() => window.print()}><Download /> Download PDF</Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <ReportView report={report} studentName={db.student.name} trend={trend} className="print-area shadow-soft" options={{ topics: settings.includeTopicBreakdown, mistakes: settings.includeMistakes }} />

        <div className="no-print space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Mail className="h-4 w-4" /> Recipients</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {settings.recipients.map((r) => (
                <div key={r.id} className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-mint font-heading text-xs font-bold">{initials(r.name)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{r.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{r.email}</p>
                  </div>
                  <Switch
                    checked={r.enabled}
                    aria-label={`Send to ${r.name}`}
                    onCheckedChange={(v) => update({ recipients: settings.recipients.map((x) => (x.id === r.id ? { ...x, enabled: v } : x)) }, v ? `${r.name} will receive reports` : `${r.name} removed from reports`)}
                  />
                </div>
              ))}
              <Button className="w-full" onClick={sendTest} disabled={sending || enabledRecipients.length === 0}>
                {sending ? <Loader2 className="animate-spin" /> : <Send />} {sending ? "Sending…" : "Send test report"}
              </Button>
              {settings.lastSentAt && <p className="text-center text-xs text-muted-foreground">Last test sent {formatDateTime(settings.lastSentAt)}</p>}
              {enabledRecipients.length === 0 && <p className="text-center text-xs text-destructive">Enable at least one recipient.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4" /> Report history</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {db.pastReports.length === 0 && <p className="text-sm text-muted-foreground">No weekly reports have been generated yet. The first one is created at the scheduled time.</p>}
              {db.pastReports.map((r) => (
                <div key={r.id} className="rounded-xl border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <button type="button" className="font-semibold hover:underline" onClick={() => setWeekId(r.id)}>Week of {formatDate(r.weekStart)}</button>
                    <Badge variant={r.status === "SENT" ? "mint" : r.status === "FAILED" ? "coral" : r.status === "PARTIAL" ? "sun" : "muted"}>{r.status.toLowerCase()}</Badge>
                  </div>
                  {r.deliveries.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                      {r.deliveries.map((d) => (
                        <li key={d.email} className="flex justify-between gap-2">
                          <span className="truncate">{d.email}</span>
                          <span className={d.status === "FAILED" ? "font-semibold text-coral-dark" : ""} title={d.error ?? undefined}>{d.status.toLowerCase()}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {(r.status === "FAILED" || r.status === "PARTIAL") && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      onClick={async () => {
                        try {
                          const res = await reportService.retryReport(r.id);
                          toast.success(`Retry finished: ${res.status.toLowerCase()}`);
                        } catch (e) {
                          toast.error(errorMessage(e));
                        }
                      }}
                    >
                      <RefreshCw /> Retry delivery
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Schedule</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="rep-enabled">Send weekly report automatically</Label>
                <Switch id="rep-enabled" checked={settings.enabled} onCheckedChange={(v) => update({ enabled: v }, v ? "Weekly reports turned on" : "Weekly reports paused")} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="rep-day">Day</Label>
                  <Select value={settings.day} onValueChange={(v) => update({ day: v as ReportSettings["day"] })} disabled={!settings.enabled}>
                    <SelectTrigger id="rep-day"><SelectValue /></SelectTrigger>
                    <SelectContent>{["Friday", "Saturday", "Sunday", "Monday"].map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rep-time">Time</Label>
                  <Input id="rep-time" type="time" key={settings.time} defaultValue={settings.time} disabled={!settings.enabled} onBlur={(e) => e.target.value && e.target.value !== settings.time && update({ time: e.target.value }, "Report time saved")} />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="rep-topics">Include topic breakdown</Label>
                <Switch id="rep-topics" checked={settings.includeTopicBreakdown} onCheckedChange={(v) => update({ includeTopicBreakdown: v })} />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="rep-mistakes">Include mistake details</Label>
                <Switch id="rep-mistakes" checked={settings.includeMistakes} onCheckedChange={(v) => update({ includeMistakes: v })} />
              </div>
              <p className="rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground">
                {settings.enabled ? `Next report: every ${settings.day} at ${settings.time}` : "Automatic reports are paused."} ({db.viewer.timezone})
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={preview} onOpenChange={setPreview}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Email preview</DialogTitle>
            <DialogDescription>
              To: {enabledRecipients.map((r) => r.email).join(", ") || "no recipients"} · Subject: {db.student.name}&apos;s weekly maths report
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-2xl bg-paper p-3 sm:p-5">
            <p className="mb-3 text-sm">Hi {enabledRecipients.map((r) => r.name.split(" ")[0]).join(" & ") || "there"}, here&apos;s how {db.student.name} did this week 👇</p>
            <ReportView report={report} studentName={db.student.name} trend={trend} options={{ topics: settings.includeTopicBreakdown, mistakes: settings.includeMistakes }} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
