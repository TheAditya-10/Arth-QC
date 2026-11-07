const DAY = 24 * 60 * 60 * 1000;

/** yyyy-mm-dd in local time */
export function dayKey(d: Date | string = new Date()): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY);
}

export function daysFromNow(n: number, hour = 18): string {
  const d = addDays(new Date(), n);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Monday-based start of week */
export function startOfWeek(d: Date = new Date()) {
  const x = startOfDay(d);
  const day = (x.getDay() + 6) % 7; // Monday = 0
  return addDays(x, -day);
}

export function daysUntil(iso: string): number {
  const target = startOfDay(new Date(iso)).getTime();
  const today = startOfDay(new Date()).getTime();
  return Math.round((target - today) / DAY);
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) {
  return new Intl.DateTimeFormat("en-IN", opts).format(new Date(iso));
}

export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function dueLabel(iso: string): string {
  const n = daysUntil(iso);
  if (n < -1) return `${Math.abs(n)} days overdue`;
  if (n === -1) return "Was due yesterday";
  if (n === 0) return "Due today";
  if (n === 1) return "Due tomorrow";
  if (n <= 6) return `Due in ${n} days`;
  return `Due ${formatDate(iso)}`;
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return formatDate(iso);
}

/** Current consecutive-day streak. A streak survives until the end of today if yesterday was studied. */
export function computeStreak(studyDays: string[], today: Date = new Date()): number {
  const set = new Set(studyDays);
  let cursor = startOfDay(today);
  if (!set.has(dayKey(cursor))) cursor = addDays(cursor, -1);
  let streak = 0;
  while (set.has(dayKey(cursor))) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function longestStreak(studyDays: string[]): number {
  const sorted = [...new Set(studyDays)].sort();
  let best = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const k of sorted) {
    const d = new Date(`${k}T00:00:00`);
    if (prev && Math.round((d.getTime() - prev.getTime()) / DAY) === 1) run++;
    else run = 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

export const WEEKDAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
