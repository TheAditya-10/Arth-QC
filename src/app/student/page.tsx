"use client";

import Link from "next/link";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowRight, BookOpenCheck, CalendarClock, CheckCircle2, Clock, Flame, ListChecks, Play, Sparkles, Target, Trophy, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mascot } from "@/components/shared/mascot";
import { PageSkeleton } from "@/components/shared/states";
import { StatTile } from "@/components/student/stat-tile";
import { WeeklyStreak } from "@/components/student/weekly-streak";
import { TopicProgressList } from "@/components/student/topic-progress-list";
import { AchievementBadge } from "@/components/rewards/achievement-badge";
import { DifficultyBadge } from "@/components/shared/status-badge";
import { useAchievements, useAppPrefs, useAssignments, useLevel, usePracticeResults, useStudent, useStudyMinutes, useTopicProgress } from "@/hooks/use-data";
import { topicName } from "@/lib/mock-data/curriculum";
import { dayKey, dueLabel, relativeTime } from "@/lib/utils";

const MOTIVATION = [
  "Mistakes are proof that you're trying. Keep going!",
  "Small steps every day add up to big wins.",
  "Your brain grows every time you solve a tricky problem.",
  "Practice makes progress — not perfect, and that's okay!",
  "Champions aren't born, they practise. Let's go!",
];

export default function StudentHome() {
  const student = useStudent();
  const assignments = useAssignments();
  const level = useLevel();
  const achievements = useAchievements();
  const topics = useTopicProgress();
  const practice = usePracticeResults();
  const minutes = useStudyMinutes();
  const prefs = useAppPrefs();

  const derived = useMemo(() => {
    if (!assignments) return null;
    const open = assignments.filter((a) => ["pending", "in_progress", "overdue"].includes(a.live));
    const upcoming = open.filter((a) => a.live !== "overdue").sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const mission = upcoming[0] ?? open[0];
    const continuing = assignments.filter((a) => a.live === "in_progress" && a.id !== mission?.id);
    const completed = assignments.filter((a) => a.live === "evaluated").length;
    return { mission, continuing, completed, pending: open.length };
  }, [assignments]);

  if (!student || !derived || !level || !achievements || !topics || !practice || !minutes) return <PageSkeleton />;

  const todayMinutes = minutes[dayKey()] ?? 0;
  const goalPct = Math.min(100, Math.round((todayMinutes / student.dailyGoalMinutes) * 100));
  const quote = MOTIVATION[new Date().getDate() % MOTIVATION.length];
  const unlocked = achievements.filter((a) => a.unlockedAt).sort((a, b) => b.unlockedAt!.localeCompare(a.unlockedAt!));
  const nextUp = achievements
    .filter((a) => !a.unlockedAt)
    .sort((a, b) => b.current / b.target - a.current / a.target)[0];
  const lastPractice = practice[0];
  const { mission } = derived;

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-indigo p-5 text-white sm:p-7"
      >
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/5" aria-hidden />
        <div className="absolute -bottom-16 right-24 h-36 w-36 rounded-full bg-sun/10" aria-hidden />
        <div className="relative flex items-center gap-4 sm:gap-6">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-sun">Hey, Champion! 👋</p>
            <h1 className="mt-1 font-heading text-3xl font-bold sm:text-4xl">Hi {student.name}!</h1>
            {prefs?.showLeaderboardHints !== false && <p className="mt-2 max-w-md text-indigo-100">{quote}</p>}
            <div className="mt-5 max-w-sm rounded-2xl bg-white/10 p-3.5">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 font-semibold"><Target className="h-4 w-4 text-sun" /> Today&apos;s goal</span>
                <span className="text-indigo-100">{todayMinutes}/{student.dailyGoalMinutes} min</span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/15">
                <motion.div className="h-full rounded-full bg-sun" initial={{ width: 0 }} animate={{ width: `${goalPct}%` }} transition={{ duration: 1, delay: 0.3 }} />
              </div>
              <p className="mt-1.5 text-xs text-indigo-200">
                {goalPct >= 100 ? "Goal smashed! 🎉" : `Study ${student.dailyGoalMinutes} minutes today — finish a mission or a quick practice.`}
              </p>
            </div>
          </div>
          <Mascot mood="wave" className="hidden h-32 w-32 shrink-0 sm:block lg:h-40 lg:w-40" />
        </div>
      </motion.section>

      {/* Stats */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" aria-label="Learning statistics">
        <StatTile icon={Flame} tone="coral" label="Day streak" value={student.streak} hint={`Best: ${student.longestStreak} days`} />
        <StatTile icon={Sparkles} tone="sun" label="Total XP" value={student.xp.toLocaleString("en-IN")} hint={`${level.xpForNext - level.xpIntoLevel} XP to next level`} delay={0.05} />
        <StatTile icon={Trophy} tone="lavender" label={level.title} value={`Level ${level.level}`} hint={`${level.progress}% to level ${level.level + 1}`} delay={0.1} />
        <StatTile icon={CheckCircle2} tone="mint" label="Missions done" value={derived.completed} hint={`${derived.pending} still open`} delay={0.15} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        {/* Today's mission */}
        {mission ? (
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b bg-sun-light/60 px-5 py-3">
              <p className="flex items-center gap-2 text-sm font-bold text-sun-dark"><Zap className="h-4 w-4" /> Today&apos;s Mission</p>
              <span className="text-sm font-semibold text-coral-dark">{dueLabel(mission.dueDate)}</span>
            </div>
            <CardContent className="p-5">
              <p className="text-sm font-semibold text-muted-foreground">Mathematics · {topicName(mission.topicId)}</p>
              <h2 className="mt-1 font-heading text-2xl font-bold">{mission.title}</h2>
              <p className="mt-2 text-muted-foreground">{mission.description}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-sm">
                <span className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 font-medium"><ListChecks className="h-4 w-4" /> {mission.questions.length} questions</span>
                <span className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 font-medium"><Clock className="h-4 w-4" /> ~{mission.estimatedMinutes} min</span>
                <span className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 font-medium"><CalendarClock className="h-4 w-4" /> {mission.maxMarks} marks</span>
                <DifficultyBadge difficulty={mission.difficulty} />
              </div>
              <Button asChild size="lg" variant="sun" className="mt-5 w-full sm:w-auto">
                <Link href={`/student/homework/${mission.id}`}>
                  <Play className="fill-current" /> {mission.live === "in_progress" ? "Continue Mission" : "Start Mission"}
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="flex flex-col items-center justify-center p-8 text-center">
            <Mascot mood="celebrate" className="h-24 w-24" />
            <h2 className="mt-3 font-heading text-xl font-bold">All missions complete!</h2>
            <p className="mt-1 text-muted-foreground">Amazing work. Try a practice challenge to earn bonus XP.</p>
            <Button asChild className="mt-4"><Link href="/student/practice">Go to practice</Link></Button>
          </Card>
        )}

        {/* Weekly streak */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><Flame className="h-5 w-5 text-coral-dark" /> This week</CardTitle>
            <span className="rounded-full bg-coral-light px-2.5 py-0.5 text-sm font-bold text-coral-dark">{student.streak} day streak</span>
          </CardHeader>
          <CardContent>
            <WeeklyStreak studyDays={student.studyDays} streak={student.streak} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Continue learning */}
        <Card>
          <CardHeader>
            <CardTitle>Continue learning</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {derived.continuing.map((a) => (
              <Link key={a.id} href={`/student/homework/${a.id}`} className="flex items-center gap-3 rounded-xl border p-3 transition hover:bg-secondary/60">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sun-light text-sun-dark"><BookOpenCheck className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{a.title}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-sun-dark" style={{ width: `${a.progress ?? 0}%` }} /></div>
                    <span className="text-xs font-semibold text-muted-foreground">{a.progress ?? 0}%</span>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-indigo-300" />
              </Link>
            ))}
            {lastPractice && (
              <Link href="/student/practice" className="flex items-center gap-3 rounded-xl border p-3 transition hover:bg-secondary/60">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-lavender text-indigo"><Zap className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">Practice: {topicName(lastPractice.config.topicId)}</p>
                  <p className="text-xs text-muted-foreground">
                    Scored {lastPractice.correct}/{lastPractice.total} · {relativeTime(lastPractice.completedAt)} · Practise again
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-indigo-300" />
              </Link>
            )}
            {derived.continuing.length === 0 && !lastPractice && (
              <p className="py-6 text-center text-sm text-muted-foreground">Nothing in progress — start today&apos;s mission!</p>
            )}
          </CardContent>
        </Card>

        {/* Achievements */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Badges</CardTitle>
            <Link href="/student/rewards" className="text-sm font-semibold text-indigo-500 hover:text-indigo">See all →</Link>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              {unlocked.slice(0, 3).map((a, i) => (
                <AchievementBadge key={a.id} a={a} size="sm" index={i} />
              ))}
            </div>
            {nextUp && (
              <div className="mt-4 rounded-xl bg-secondary/70 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">Next: {nextUp.title}</span>
                  <span className="font-heading font-bold">{nextUp.current}/{nextUp.target}</span>
                </div>
                <p className="text-xs text-muted-foreground">{nextUp.description}</p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                  <motion.div className="h-full rounded-full bg-indigo" initial={{ width: 0 }} animate={{ width: `${(nextUp.current / nextUp.target) * 100}%` }} transition={{ duration: 0.9 }} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Learning progress */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>My maths topics</CardTitle>
            <p className="text-sm text-muted-foreground">How well you know each chapter</p>
          </div>
          <Link href="/student/progress" className="text-sm font-semibold text-indigo-500 hover:text-indigo">Full progress →</Link>
        </CardHeader>
        <CardContent className="grid gap-x-10 md:grid-cols-2">
          <TopicProgressList topics={topics.slice(0, 4)} />
          <div className="mt-4 md:mt-0">
            <TopicProgressList topics={topics.slice(4)} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
