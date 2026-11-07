"use client";

import type { Reward, RewardStatus } from "@/types";
import { sleep, uid } from "@/lib/utils";
import type { RewardFormValues } from "@/lib/validations/assignment";
import { getDB, setDB } from "./store";
import { applyProgress } from "./progress-engine";

export const TRIGGER_LABELS: Record<Reward["trigger"], { label: string; unit: string; describe: (n: number) => string }> = {
  streak: { label: "Streak milestone", unit: "days", describe: (n) => `Reach a ${n}-day study streak` },
  xp: { label: "XP milestone", unit: "XP", describe: (n) => `Earn ${n.toLocaleString("en-IN")} XP` },
  score: { label: "Score-based", unit: "%", describe: (n) => `Score ${n}% or more` },
  improvement: { label: "Improvement", unit: "points", describe: (n) => `Improve a score by ${n} percentage points` },
  custom: { label: "Custom (manual)", unit: "", describe: () => "Unlocked by a parent" },
};

export async function createReward(values: RewardFormValues): Promise<Reward> {
  await sleep(500);
  const reward: Reward = {
    id: uid("r"),
    title: values.title,
    description: values.description,
    trigger: values.trigger,
    threshold: values.trigger === "custom" ? 0 : values.threshold,
    emoji: values.emoji,
    status: "locked",
    createdBy: "parent_1",
  };
  setDB((db) => applyProgress({ ...db, rewards: [reward, ...db.rewards] }));
  return getDB().rewards.find((r) => r.id === reward.id) ?? reward;
}

export async function updateReward(id: string, values: Partial<RewardFormValues>): Promise<void> {
  await sleep(400);
  setDB((db) => applyProgress({ ...db, rewards: db.rewards.map((r) => (r.id === id ? { ...r, ...values } : r)) }));
}

export async function setRewardStatus(id: string, status: RewardStatus): Promise<void> {
  await sleep(400);
  const now = new Date().toISOString();
  setDB((db) => ({
    ...db,
    rewards: db.rewards.map((r) =>
      r.id === id
        ? {
            ...r,
            status,
            unlockedAt: status === "locked" ? undefined : r.unlockedAt ?? now,
            deliveredAt: status === "delivered" ? now : undefined,
          }
        : r,
    ),
  }));
}

export async function deleteReward(id: string): Promise<void> {
  await sleep(350);
  setDB((db) => ({ ...db, rewards: db.rewards.filter((r) => r.id !== id) }));
}

export function dismissCelebration(id: string) {
  setDB((db) => ({ ...db, celebrations: db.celebrations.filter((c) => c !== id) }));
}

/** Progress toward a reward, 0-100. */
export function rewardProgress(r: Reward, ctx: { streak: number; xp: number; best: number; improvement: number }): number {
  if (r.status !== "locked") return 100;
  if (r.trigger === "custom" || r.threshold <= 0) return 0;
  const cur = r.trigger === "streak" ? ctx.streak : r.trigger === "xp" ? ctx.xp : r.trigger === "score" ? ctx.best : ctx.improvement;
  return Math.min(100, Math.round((cur / r.threshold) * 100));
}
