import { describe, expect, it } from "vitest";
import { sniffMime } from "@/lib/storage/upload.service";
import { redactPII } from "@/lib/services/buddy.service";
import { addDaysStr, localClock, localDateIn, startOfLocalDay, weekStartOf } from "@/lib/utils/timezone";
import { reportWeekFor } from "@/lib/services/report.service";

describe("upload signature sniffing", () => {
  it("detects real file types from magic bytes", () => {
    expect(sniffMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]))).toBe("image/png");
    expect(sniffMime(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]))).toBe("application/pdf");
    expect(sniffMime(new TextEncoder().encode("RIFF1234WEBPVP8 "))).toBe("image/webp");
    expect(sniffMime(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
  });
});

describe("AI buddy privacy", () => {
  it("redacts emails and phone numbers", () => {
    const r = redactPII("my mum's email is mum@example.com and phone +91 98765 43210, what is 2+2?");
    expect(r.redacted).toBe(true);
    expect(r.text).not.toMatch(/example\.com|98765/);
    expect(r.text).toMatch(/2\+2/);
  });
  it("leaves maths alone", () => {
    expect(redactPII("what is 1245 × 375?").redacted).toBe(false);
  });
});

describe("timezone handling (Asia/Kolkata default)", () => {
  it("uses the local calendar day, not UTC", () => {
    // 2026-11-07 20:00 UTC is already 2026-11-08 01:30 in India.
    const d = new Date("2026-11-07T20:00:00Z");
    expect(localDateIn("Asia/Kolkata", d)).toBe("2026-11-08");
    expect(localDateIn("UTC", d)).toBe("2026-11-07");
  });
  it("computes local clock and local midnight", () => {
    expect(localClock("Asia/Kolkata", new Date("2026-11-08T13:30:00Z"))).toEqual({ weekday: 0, hhmm: "19:00" });
    expect(startOfLocalDay("Asia/Kolkata", "2026-11-08").toISOString()).toBe("2026-11-07T18:30:00.000Z");
  });
  it("does Monday-based weeks and date arithmetic", () => {
    expect(weekStartOf("2026-11-08")).toBe("2026-11-02"); // Sunday → Monday of same week
    expect(weekStartOf("2026-11-09")).toBe("2026-11-09");
    expect(addDaysStr("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("reports cover the current week on Sundays, the previous week otherwise", () => {
    expect(reportWeekFor("2026-11-08", 0)).toBe("2026-11-02");
    expect(reportWeekFor("2026-11-09", 1)).toBe("2026-11-02");
  });
});
