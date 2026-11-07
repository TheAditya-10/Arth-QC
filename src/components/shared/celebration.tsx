"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAchievements, useAppPrefs, useCelebrations } from "@/hooks/use-data";
import { rewardService } from "@/lib/client";
import { achievementIcon } from "./icons";
import { Mascot } from "./mascot";

// --- Pause celebrations while the student is focused (quiz, evaluation) ---
let pauseCount = 0;
const pauseListeners = new Set<() => void>();
const notifyPause = () => pauseListeners.forEach((l) => l());
function subscribePause(l: () => void) {
  pauseListeners.add(l);
  return () => pauseListeners.delete(l);
}
/** Call in components where a pop-up would interrupt the student. */
export function usePauseCelebrations(active = true) {
  useEffect(() => {
    if (!active) return;
    pauseCount++;
    notifyPause();
    return () => {
      pauseCount--;
      notifyPause();
    };
  }, [active]);
}

const CONFETTI_COLORS = ["#FFD66B", "#BCEBD6", "#FF9C88", "#EEEAFE", "#292B59"];

export function Confetti({ count = 36 }: { count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        id: i,
        x: (i * 53) % 100,
        delay: (i % 10) * 0.05,
        rotate: (i * 47) % 360,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: 6 + (i % 4) * 2,
      })),
    [count],
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className="absolute top-0 block rounded-sm"
          style={{ left: `${p.x}%`, width: p.size, height: p.size * 0.6, background: p.color }}
          initial={{ y: -20, opacity: 1, rotate: 0 }}
          animate={{ y: 420, opacity: [1, 1, 0], rotate: p.rotate + 360 }}
          transition={{ duration: 1.8 + (p.id % 5) * 0.2, delay: p.delay, ease: "easeIn" }}
        />
      ))}
    </div>
  );
}

/** Shows a celebratory modal for each newly unlocked achievement in the queue. */
export function CelebrationHost() {
  const queue = useCelebrations();
  const achievements = useAchievements();
  const prefs = useAppPrefs();
  const paused = useSyncExternalStore(subscribePause, () => pauseCount > 0, () => false);
  const [open, setOpen] = useState(false);
  const currentId = queue?.[0];
  const achievement = achievements?.find((a) => a.id === currentId);

  useEffect(() => {
    if (currentId && prefs && !prefs.celebrations) {
      rewardService.dismissCelebration(currentId);
      return;
    }
    if (currentId && !paused) {
      const t = setTimeout(() => setOpen(true), 400);
      return () => clearTimeout(t);
    }
  }, [currentId, prefs, paused]);

  if (!achievement) return null;
  const Icon = achievementIcon(achievement.icon);
  const close = () => {
    setOpen(false);
    setTimeout(() => rewardService.dismissCelebration(achievement.id), 200);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-sm overflow-hidden text-center" hideClose>
        <AnimatePresence>{open && <Confetti />}</AnimatePresence>
        <motion.div
          initial={{ scale: 0.4, rotate: -20, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.1 }}
          className="relative mx-auto mt-2 flex h-24 w-24 items-center justify-center rounded-3xl bg-sun shadow-[0_4px_0_#B98A12]"
        >
          <Icon className="h-12 w-12 text-indigo" strokeWidth={2.2} />
        </motion.div>
        <div className="relative">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-mint-dark">Badge unlocked!</p>
          <DialogTitle className="mt-1 text-2xl">{achievement.title}</DialogTitle>
          <DialogDescription className="mt-1 text-base">{achievement.description}</DialogDescription>
          <p className="mt-3 inline-flex items-center rounded-full bg-sun-light px-3 py-1 text-sm font-bold text-sun-dark">
            +{achievement.xpReward} XP
          </p>
        </div>
        <div className="relative flex items-center justify-center">
          <Mascot mood="celebrate" className="h-20 w-20" />
        </div>
        <Button size="lg" variant="default" onClick={close} className="relative w-full">
          Awesome!
        </Button>
      </DialogContent>
    </Dialog>
  );
}
