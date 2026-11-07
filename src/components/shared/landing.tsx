"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, BookOpenCheck, Gift, LineChart, MessageCircleHeart, ScanLine, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { Mascot } from "@/components/shared/mascot";
import type { Role } from "@/types";

const roles: {
  role: Role;
  title: string;
  subtitle: string;
  points: { icon: typeof Gift; text: string }[];
  className: string;
  cta: string;
}[] = [
  {
    role: "student",
    title: "I'm a student",
    subtitle: "Sign in with your username & PIN",
    points: [
      { icon: BookOpenCheck, text: "Do homework missions & upload notebook pages" },
      { icon: MessageCircleHeart, text: "Get hints from Arthu, your AI buddy" },
      { icon: Gift, text: "Earn XP, badges and real rewards" },
    ],
    className: "bg-indigo text-white",
    cta: "Start learning",
  },
  {
    role: "parent",
    title: "I'm a parent",
    subtitle: "Sign in with your email",
    points: [
      { icon: ScanLine, text: "Assign homework & review AI evaluations" },
      { icon: LineChart, text: "Track progress, weak topics and streaks" },
      { icon: ShieldCheck, text: "Weekly reports and reward management" },
    ],
    className: "bg-card text-indigo border",
    cta: "Open parent console",
  },
];

export function Landing() {
  const router = useRouter();
  const choose = (role: Role) => router.push(role === "student" ? "/login?as=student" : "/login");

  return (
    <div className="relative min-h-screen overflow-hidden bg-lavender/60">
      <div className="bg-dots absolute inset-0 opacity-60" aria-hidden />
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-6 sm:px-8">
        <header className="flex items-center justify-between">
          <Logo />
          <Link href="/register" className="rounded-full border border-indigo-200 bg-white/70 px-3 py-1.5 text-xs font-semibold text-indigo-500 hover:bg-white">
            Create a family account
          </Link>
        </header>

        <div className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1.05fr_1fr] lg:py-0">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-sun-light px-3 py-1 text-sm font-semibold text-sun-dark">
              <span className="h-2 w-2 rounded-full bg-sun-dark" /> Maths for Class 6 · NCERT
            </div>
            <h1 className="text-balance font-heading text-4xl font-bold leading-[1.05] text-indigo sm:text-5xl lg:text-6xl">
              Homework that checks itself. <span className="text-coral-dark">Learning</span> that feels like a game.
            </h1>
            <p className="mt-5 max-w-lg text-lg text-indigo-500">
              Arth-QC helps students learn independently with hint-first AI feedback, while parents far away assign work and follow every step of progress.
            </p>
            <div className="mt-8 flex items-center gap-4">
              <Mascot mood="wave" className="h-24 w-24" />
              <div className="relative rounded-2xl rounded-bl-sm bg-white px-4 py-3 text-sm font-medium shadow-soft">
                Hi! I&apos;m Arthu. Pick who you are to begin →
              </div>
            </div>
          </motion.div>

          <div className="grid gap-4">
            {roles.map((r, i) => (
              <motion.button
                key={r.role}
                type="button"
                onClick={() => choose(r.role)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.1 }}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.99 }}
                className={`group rounded-3xl p-6 text-left shadow-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun ${r.className}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${r.role === "student" ? "text-indigo-200" : "text-muted-foreground"}`}>
                      {r.subtitle}
                    </p>
                    <h2 className="mt-1 font-heading text-2xl font-bold">{r.title}</h2>
                  </div>
                  <span className={`flex h-11 w-11 items-center justify-center rounded-full transition-transform group-hover:translate-x-1 ${r.role === "student" ? "bg-sun text-indigo" : "bg-indigo text-white"}`}>
                    <ArrowRight className="h-5 w-5" />
                  </span>
                </div>
                <ul className="mt-5 space-y-2.5">
                  {r.points.map((p) => (
                    <li key={p.text} className="flex items-center gap-3 text-[15px]">
                      <p.icon className={`h-4 w-4 shrink-0 ${r.role === "student" ? "text-sun" : "text-mint-dark"}`} />
                      <span className={r.role === "student" ? "text-indigo-100" : "text-indigo-500"}>{p.text}</span>
                    </li>
                  ))}
                </ul>
                <p className={`mt-5 text-sm font-semibold ${r.role === "student" ? "text-sun" : "text-indigo"}`}>{r.cta} →</p>
              </motion.button>
            ))}
            <p className="text-center text-sm text-indigo-500">
              New here? <Link href="/register" className="font-semibold text-indigo underline-offset-4 hover:underline">Create a family account</Link> — parents set up student logins.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
