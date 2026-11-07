"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Flame, Gift, History, Lock, PackageCheck, Sparkles, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/states";
import { Mascot } from "@/components/shared/mascot";
import { AchievementBadge } from "@/components/rewards/achievement-badge";
import { useAchievements, useLevel, useRewards, useScoreStats, useStudent, useXPEvents } from "@/hooks/use-data";
import { rewardService } from "@/lib/client";
import { TRIGGER_LABELS } from "@/lib/client/rewards.service";
import { cn, relativeTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { errorMessage } from "@/lib/client/api";

export default function RewardsPage() {
  const student = useStudent();
  const level = useLevel();
  const achievements = useAchievements();
  const rewards = useRewards();
  const xpEvents = useXPEvents();
  const stats = useScoreStats();

  const nextMilestone = useMemo(() => {
    if (!rewards || !student || !stats) return null;
    const ctx = { streak: student.streak, xp: student.xp, ...stats };
    return rewards
      .filter((r) => r.status === "locked" && r.trigger !== "custom")
      .map((r) => ({ r, p: rewardService.rewardProgress(r, ctx) }))
      .sort((a, b) => b.p - a.p)[0];
  }, [rewards, student, stats]);

  if (!student || !level || !achievements || !rewards || !xpEvents || !stats) return <PageSkeleton />;
  const unlocked = achievements.filter((a) => a.unlockedAt);
  const locked = achievements.filter((a) => !a.unlockedAt);
  const ctx = { streak: student.streak, xp: student.xp, ...stats };

  return (
    <div className="space-y-6">
      <PageHeader title="Rewards & Badges" description="You earn rewards for showing up, improving and fixing mistakes — not just high scores!" />

      <section className="grid gap-4 lg:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-3xl bg-indigo p-6 text-white lg:col-span-2">
          <div className="flex items-center gap-5">
            <div className="relative flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-3xl bg-sun text-indigo shadow-[0_4px_0_#B98A12]">
              <span className="text-xs font-bold uppercase">Level</span>
              <span className="font-heading text-4xl font-bold leading-none">{level.level}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-sun">{level.title}</p>
              <p className="font-heading text-3xl font-bold">{student.xp.toLocaleString("en-IN")} XP</p>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/15">
                <motion.div className="h-full rounded-full bg-sun" initial={{ width: 0 }} animate={{ width: `${level.progress}%` }} transition={{ duration: 1 }} />
              </div>
              <p className="mt-1.5 text-sm text-indigo-200">{level.xpForNext - level.xpIntoLevel} XP until Level {level.level + 1}</p>
            </div>
            <Mascot mood="celebrate" className="hidden h-28 w-28 sm:block" />
          </div>
        </motion.div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-1">
          <Card className="flex items-center gap-3 p-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-coral text-white"><Flame className="h-6 w-6" /></span>
            <div>
              <p className="font-heading text-2xl font-bold leading-none">{student.streak} days</p>
              <p className="text-sm text-muted-foreground">Current streak</p>
            </div>
          </Card>
          <Card className="flex items-center gap-3 p-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mint text-mint-dark"><Trophy className="h-6 w-6" /></span>
            <div>
              <p className="font-heading text-2xl font-bold leading-none">{unlocked.length}/{achievements.length}</p>
              <p className="text-sm text-muted-foreground">Badges earned</p>
            </div>
          </Card>
        </div>
      </section>

      {nextMilestone && (
        <Card className="border-sun bg-sun-light/40">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
            <span className="text-4xl" aria-hidden>{nextMilestone.r.emoji}</span>
            <div className="flex-1">
              <p className="text-xs font-bold uppercase tracking-wide text-sun-dark">Next milestone</p>
              <p className="font-heading text-lg font-semibold">{nextMilestone.r.title}</p>
              <p className="text-sm text-muted-foreground">{TRIGGER_LABELS[nextMilestone.r.trigger].describe(nextMilestone.r.threshold)}</p>
            </div>
            <div className="w-full sm:w-48">
              <div className="h-3 overflow-hidden rounded-full bg-white">
                <motion.div className="h-full rounded-full bg-sun-dark" initial={{ width: 0 }} animate={{ width: `${nextMilestone.p}%` }} transition={{ duration: 1 }} />
              </div>
              <p className="mt-1 text-right text-sm font-bold">{nextMilestone.p}%</p>
            </div>
          </CardContent>
        </Card>
      )}

      <section>
        <h2 className="mb-3 font-heading text-xl font-bold">Badges earned</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {unlocked.map((a, i) => <AchievementBadge key={a.id} a={a} index={i} />)}
        </div>
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 font-heading text-xl font-bold"><Lock className="h-5 w-5 text-indigo-300" /> Still to unlock</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {locked.map((a, i) => <AchievementBadge key={a.id} a={a} index={i} />)}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Gift className="h-5 w-5 text-coral-dark" /> Real-life rewards</CardTitle>
            <p className="text-sm text-muted-foreground">Set up by Mumma & Papa</p>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {rewards.map((r) => {
              const p = rewardService.rewardProgress(r, ctx);
              return (
                <div key={r.id} className={cn("flex items-center gap-3 rounded-2xl border p-3", r.status !== "locked" && "border-mint bg-mint-light/40")}>
                  <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl", r.status === "locked" ? "bg-muted grayscale" : "bg-white")} aria-hidden>{r.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{r.title}</p>
                    <p className="text-xs text-muted-foreground">{TRIGGER_LABELS[r.trigger].describe(r.threshold)}</p>
                    {r.status === "locked" && r.trigger !== "custom" && (
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-indigo" style={{ width: `${p}%` }} /></div>
                    )}
                  </div>
                  {r.status === "delivered" ? (
                    <span className="flex items-center gap-1 text-xs font-bold text-mint-dark"><PackageCheck className="h-4 w-4" /> Received</span>
                  ) : r.status === "unlocked" ? (
                    <Button
                      size="sm"
                      variant="sun"
                      onClick={async () => {
                        try {
                          await rewardService.requestReward(r.id);
                          toast.success("Request sent!", { description: "Mumma or Papa will see it in their dashboard." });
                        } catch (e) {
                          toast.error(errorMessage(e));
                        }
                      }}
                    >
                      Ask for it
                    </Button>
                  ) : r.status === "requested" ? (
                    <span className="rounded-full bg-lavender px-2 py-0.5 text-xs font-bold text-indigo">Requested</span>
                  ) : r.status === "approved" ? (
                    <span className="rounded-full bg-mint px-2 py-0.5 text-xs font-bold text-mint-dark">Approved!</span>
                  ) : (
                    <Lock className="h-4 w-4 text-indigo-300" aria-label="Locked" />
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><History className="h-5 w-5 text-indigo-400" /> XP history</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {xpEvents.slice(0, 10).map((x) => (
                <li key={x.id} className="flex items-center gap-3 py-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sun-light text-sun-dark"><Sparkles className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{x.label}</p>
                    <p className="text-xs text-muted-foreground">{relativeTime(x.at)}</p>
                  </div>
                  <span className="font-heading font-bold text-sun-dark">+{x.xp}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
