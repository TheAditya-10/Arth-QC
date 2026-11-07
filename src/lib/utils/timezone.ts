/**
 * Timezone-aware calendar helpers (no external deps). Day boundaries follow the
 * family's IANA timezone, default Asia/Kolkata.
 */
export const DEFAULT_TZ = "Asia/Kolkata";

/** yyyy-mm-dd for `date` in `tz`. */
export function localDateIn(tz: string, date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Day of week (0=Sun) and HH:mm for `date` in `tz`. */
export function localClock(tz: string, date: Date = new Date()): { weekday: number; hhmm: string } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const h = parts.find((p) => p.type === "hour")?.value ?? "00";
  const m = parts.find((p) => p.type === "minute")?.value ?? "00";
  return { weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd), hhmm: `${h}:${m}` };
}

/** Add days to a yyyy-mm-dd string (calendar arithmetic, timezone-free). */
export function addDaysStr(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86400000);
}

/** Monday of the week containing `day` (yyyy-mm-dd). */
export function weekStartOf(day: string): string {
  const dow = new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 = Sun
  return addDaysStr(day, -((dow + 6) % 7));
}

/** UTC instant of local midnight at the start of `day` in `tz`. */
export function startOfLocalDay(tz: string, day: string): Date {
  // Find the offset by formatting a guess and correcting.
  const guess = new Date(`${day}T00:00:00Z`);
  const offsetMin = tzOffsetMinutes(tz, guess);
  return new Date(guess.getTime() - offsetMin * 60000);
}

function tzOffsetMinutes(tz: string, date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUTC = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second"));
  return Math.round((asUTC - date.getTime()) / 60000);
}

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
