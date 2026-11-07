import { addDaysStr } from "@/lib/utils/timezone";

export interface StreakState {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string | null;
}

/** Pure transition when a qualifying activity happens on `today` (local date). */
export function nextStreak(s: StreakState, today: string): StreakState {
  if (s.lastActivityDate === today) return s;
  const continues = s.lastActivityDate === addDaysStr(today, -1);
  const current = continues ? s.currentStreak + 1 : 1;
  return { currentStreak: current, longestStreak: Math.max(s.longestStreak, current), lastActivityDate: today };
}

/**
 * Streak as shown to users. A streak stays alive through "today" if yesterday
 * was studied; it is only displayed as broken — never reset by a failed request.
 */
export function effectiveStreak(s: StreakState, today: string): number {
  if (!s.lastActivityDate) return 0;
  if (s.lastActivityDate === today || s.lastActivityDate === addDaysStr(today, -1)) return s.currentStreak;
  return 0;
}
