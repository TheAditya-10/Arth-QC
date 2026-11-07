"use client";

import type { Reward, RewardStatus } from "@/types";
import type { RewardFormValues } from "@/lib/validations/assignment";
import { api } from "./api";
import { dismissedCelebrations, peekState, refresh, setDB } from "./store";

export const TRIGGER_LABELS: Record<Reward["trigger"], { label: string; unit: string; describe: (n: number) => string }> = {
  streak: { label: "Streak milestone", unit: "days", describe: (n) => `Reach a ${n}-day study streak` },
  xp: { label: "XP milestone", unit: "XP", describe: (n) => `Earn ${n.toLocaleString("en-IN")} XP` },
  score: { label: "Score-based", unit: "%", describe: (n) => `Score ${n}% or more on homework` },
  improvement: { label: "Improvement", unit: "points", describe: (n) => `Improve a score by ${n} percentage points` },
  custom: { label: "Custom (manual)", unit: "", describe: () => "Unlocked by a parent" },
};

const studentId = () => peekState()?.viewer.activeStudentId;

export async function createReward(values: RewardFormValues): Promise<Reward> {
  await api("POST", "/api/rewards", values);
  await refresh();
  return peekState()!.rewards[0];
}

export async function updateReward(id: string, values: Partial<RewardFormValues>): Promise<void> {
  const current = peekState()?.rewards.find((r) => r.id === id);
  await api("PUT", `/api/rewards/${id}`, {
    title: values.title ?? current?.title,
    description: values.description ?? current?.description ?? "",
    trigger: values.trigger ?? current?.trigger,
    threshold: values.threshold ?? current?.threshold ?? 0,
    emoji: values.emoji ?? current?.emoji ?? "🎁",
  });
  await refresh();
}

/** Parent actions on a reward for the active student. */
export async function decideReward(id: string, action: "approve" | "decline" | "deliver" | "grant" | "reset") {
  await api("POST", `/api/rewards/${id}/decision`, { studentProfileId: studentId(), action });
  await refresh();
}

/** Back-compat for Phase 1 components: map target status to a decision. */
export async function setRewardStatus(id: string, status: RewardStatus): Promise<void> {
  const map: Partial<Record<RewardStatus, "approve" | "deliver" | "grant" | "reset">> = { delivered: "deliver", unlocked: "grant", approved: "approve", locked: "reset" };
  const action = map[status];
  if (action) await decideReward(id, action);
}

export async function deleteReward(id: string): Promise<void> {
  await api("DELETE", `/api/rewards/${id}`);
  await refresh();
}

/** Student asks for an unlocked reward. */
export async function requestReward(id: string) {
  await api("POST", `/api/rewards/${id}/redeem`);
  await refresh();
}

export function dismissCelebration(code: string) {
  dismissedCelebrations.add(code);
  setDB((db) => ({ ...db, celebrations: db.celebrations.filter((c) => c !== code) }));
  void api("POST", "/api/achievements/celebrated", { codes: [code] }).catch(() => {});
}

/** Progress toward a reward, 0-100 (computed on the server). */
export function rewardProgress(r: Reward, ...ctx: unknown[]): number {
  void ctx;
  return r.progress ?? (r.status === "locked" ? 0 : 100);
}
