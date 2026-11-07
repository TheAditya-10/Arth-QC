"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type MascotMood = "happy" | "thinking" | "celebrate" | "wave";

/** Arthu the owl — the Arth-QC learning buddy. Simple geometric shapes, brand colours only. */
export function Mascot({ mood = "happy", className, animate = true }: { mood?: MascotMood; className?: string; animate?: boolean }) {
  const eyeY = mood === "thinking" ? 33 : 35;
  return (
    <motion.svg
      viewBox="0 0 100 100"
      className={cn("h-24 w-24", className)}
      aria-hidden
      initial={false}
      animate={animate ? { y: [0, -4, 0] } : undefined}
      transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
    >
      {/* ear tufts */}
      <path d="M24 26 L30 8 L40 22 Z" fill="#292B59" />
      <path d="M76 26 L70 8 L60 22 Z" fill="#292B59" />
      {/* body */}
      <rect x="18" y="16" width="64" height="72" rx="30" fill="#292B59" />
      {/* belly */}
      <ellipse cx="50" cy="66" rx="20" ry="17" fill="#EEEAFE" />
      <path d="M40 62 q5 4 10 0 q5 4 10 0" stroke="#C6C5E6" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M42 70 q4 3 8 0 q4 3 8 0" stroke="#C6C5E6" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* eyes */}
      <circle cx="37" cy="36" r="12" fill="#FAF9F6" />
      <circle cx="63" cy="36" r="12" fill="#FAF9F6" />
      {mood === "celebrate" ? (
        <>
          <path d="M31 37 q6 -7 12 0" stroke="#292B59" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <path d="M57 37 q6 -7 12 0" stroke="#292B59" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx={mood === "thinking" ? 40 : 38} cy={eyeY} r="5.5" fill="#292B59" />
          <circle cx={mood === "thinking" ? 66 : 64} cy={eyeY} r="5.5" fill="#292B59" />
          <circle cx={mood === "thinking" ? 41.5 : 39.5} cy={eyeY - 2} r="1.8" fill="#fff" />
          <circle cx={mood === "thinking" ? 67.5 : 65.5} cy={eyeY - 2} r="1.8" fill="#fff" />
        </>
      )}
      {/* beak */}
      <path d="M46 46 L54 46 L50 53 Z" fill="#FFD66B" />
      {/* cheeks */}
      <circle cx="27" cy="48" r="4" fill="#FF9C88" opacity="0.7" />
      <circle cx="73" cy="48" r="4" fill="#FF9C88" opacity="0.7" />
      {/* wings */}
      {mood === "wave" || mood === "celebrate" ? (
        <>
          <motion.path
            d="M18 58 q-14 -10 -10 -26"
            stroke="#292B59"
            strokeWidth="9"
            strokeLinecap="round"
            fill="none"
            animate={animate ? { rotate: [0, -12, 0] } : undefined}
            style={{ originX: "18px", originY: "58px" }}
            transition={{ duration: 0.8, repeat: Infinity }}
          />
          {mood === "celebrate" && <path d="M82 58 q14 -10 10 -26" stroke="#292B59" strokeWidth="9" strokeLinecap="round" fill="none" />}
        </>
      ) : (
        <>
          <path d="M20 54 q-6 12 4 22" stroke="#383A72" strokeWidth="8" strokeLinecap="round" fill="none" />
          <path d="M80 54 q6 12 -4 22" stroke="#383A72" strokeWidth="8" strokeLinecap="round" fill="none" />
        </>
      )}
      {/* feet */}
      <path d="M40 88 v5 M44 88 v5 M56 88 v5 M60 88 v5" stroke="#FFD66B" strokeWidth="3" strokeLinecap="round" />
      {mood === "thinking" && <circle cx="86" cy="14" r="5" fill="#FFD66B" />}
    </motion.svg>
  );
}
