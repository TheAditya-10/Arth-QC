"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { BarChart3, BookOpenCheck, Flame, Gift, Home, MessageCircleHeart, Sparkles, Zap } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { Mascot } from "@/components/shared/mascot";
import { RoleSwitcher } from "@/components/shared/role-switcher";
import { CelebrationHost } from "@/components/shared/celebration";
import { useLevel, useStudent } from "@/hooks/use-data";
import { cn, initials } from "@/lib/utils";

export const STUDENT_NAV = [
  { href: "/student", label: "Home", icon: Home, mobile: true },
  { href: "/student/homework", label: "My Homework", short: "Homework", icon: BookOpenCheck, mobile: true },
  { href: "/student/practice", label: "Practice", icon: Zap, mobile: true },
  { href: "/student/progress", label: "My Progress", short: "Progress", icon: BarChart3, mobile: true },
  { href: "/student/rewards", label: "Rewards", icon: Gift, mobile: false },
  { href: "/student/ai-buddy", label: "AI Buddy", short: "Buddy", icon: MessageCircleHeart, mobile: true },
];

function isActive(pathname: string, href: string) {
  if (href === "/student") return pathname === "/student";
  if (href === "/student/homework") return pathname.startsWith("/student/homework") || pathname.startsWith("/student/submissions");
  return pathname.startsWith(href);
}

export function StudentShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const student = useStudent();
  const level = useLevel();
  const fullBleed = pathname.startsWith("/student/ai-buddy");

  return (
    <div className="min-h-screen bg-lavender/40">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-indigo-100/70 bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 lg:px-6">
          <Logo href="/student" sub="Learn · Practise · Grow" />
          <div className="flex items-center gap-2">
            <Link
              href="/student/rewards"
              className="flex items-center gap-1 rounded-full bg-coral-light px-3 py-1.5 text-sm font-bold text-coral-dark transition hover:scale-105"
              aria-label={`Current streak ${student?.streak ?? 0} days`}
            >
              <Flame className="h-4 w-4" /> {student?.streak ?? "–"}
            </Link>
            <Link
              href="/student/rewards"
              className="flex items-center gap-1 rounded-full bg-sun-light px-3 py-1.5 text-sm font-bold text-sun-dark transition hover:scale-105"
              aria-label={`${student?.xp ?? 0} XP`}
            >
              <Sparkles className="h-4 w-4" /> {student ? student.xp.toLocaleString("en-IN") : "–"}
              <span className="hidden sm:inline">XP</span>
            </Link>
            <RoleSwitcher current="student" compact className="sm:hidden" />
            <RoleSwitcher current="student" className="hidden sm:inline-flex" />
            <div
              className="hidden h-10 w-10 items-center justify-center rounded-full bg-sun font-heading font-bold text-indigo md:flex"
              title={student?.name}
            >
              {student ? initials(student.name) : ""}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-4 lg:px-6">
        {/* Desktop sidebar */}
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-60 shrink-0 flex-col py-6 lg:flex">
          <nav className="space-y-1" aria-label="Student navigation">
            {STUDENT_NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-semibold transition-colors",
                    active ? "text-indigo" : "text-indigo-500 hover:bg-white/70 hover:text-indigo",
                  )}
                >
                  {active && (
                    <motion.span layoutId="student-nav-active" className="absolute inset-0 rounded-xl bg-white shadow-soft" transition={{ type: "spring", stiffness: 400, damping: 32 }} />
                  )}
                  <item.icon className="relative h-5 w-5" />
                  <span className="relative">{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto rounded-2xl bg-indigo p-4 text-white">
            <div className="flex items-center gap-3">
              <Mascot className="h-14 w-14" mood="wave" />
              <div>
                <p className="text-xs text-indigo-200">Level {level?.level ?? "–"}</p>
                <p className="font-heading font-semibold leading-tight">{level?.title ?? "…"}</p>
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15">
              <motion.div className="h-full rounded-full bg-sun" initial={{ width: 0 }} animate={{ width: `${level?.progress ?? 0}%` }} transition={{ duration: 1 }} />
            </div>
            <p className="mt-1.5 text-xs text-indigo-200">
              {level ? `${level.xpForNext - level.xpIntoLevel} XP to level ${level.level + 1}` : ""}
            </p>
          </div>
        </aside>

        <main className={cn("min-w-0 flex-1 pb-28 pt-5 lg:pb-10 lg:pt-6", fullBleed && "pb-24")}>{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <nav
        className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-indigo-100 bg-paper/95 backdrop-blur-md lg:hidden"
        aria-label="Student navigation"
      >
        <div className="mx-auto grid max-w-md grid-cols-5 px-2">
          {STUDENT_NAV.filter((n) => n.mobile).map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn("relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold", active ? "text-indigo" : "text-indigo-400")}
                aria-current={active ? "page" : undefined}
              >
                {active && <motion.span layoutId="student-bottom-active" className="absolute top-0 h-1 w-8 rounded-b-full bg-indigo" />}
                <span className={cn("flex h-8 w-12 items-center justify-center rounded-full transition-colors", active && "bg-lavender")}>
                  <item.icon className="h-5 w-5" />
                </span>
                {item.short ?? item.label}
              </Link>
            );
          })}
        </div>
      </nav>
      <CelebrationHost />
    </div>
  );
}
