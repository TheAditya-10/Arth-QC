import type {
  Achievement,
  AppPreferences,
  ChatMessage,
  NotificationPreferences,
  PracticeResult,
  ReportSettings,
  Reward,
  StudentProfile,
  TopicProgress,
  User,
  WeeklyReport,
  XPEvent,
} from "@/types";
import { addDays, dayKey, daysFromNow, startOfWeek } from "@/lib/utils/dates";

/** Change these to personalise the demo. */
export const DEMO_STUDENT_NAME = "Ananya";

export function seedUsers(): User[] {
  return [
    { id: "student_1", name: DEMO_STUDENT_NAME, email: "ananya@example.com", role: "student", avatarColor: "#FFD66B" },
    { id: "parent_1", name: "Priya Sharma", email: "priya.parent@example.com", role: "parent", avatarColor: "#BCEBD6", relation: "Mother" },
    { id: "parent_2", name: "Rahul Sharma", email: "rahul.parent@example.com", role: "parent", avatarColor: "#FF9C88", relation: "Father" },
  ];
}

function seedStudyDays(): string[] {
  // Studied on the 5 days before today (streak = 5, today still open), plus a scattered history.
  const today = new Date();
  const offsets = [1, 2, 3, 4, 5, 7, 8, 9, 11, 12, 14, 15, 16, 17, 18, 19, 21, 22, 24, 25, 27, 29, 30, 32, 33, 35, 36];
  return offsets.map((o) => dayKey(addDays(today, -o)));
}

export function seedStudent(): StudentProfile {
  return {
    id: "student_1",
    userId: "student_1",
    name: DEMO_STUDENT_NAME,
    grade: 6,
    curriculum: "NCERT",
    school: "Kendriya Vidyalaya, Sector 8",
    subjects: ["mathematics"],
    dailyGoalMinutes: 30,
    xp: 1280,
    level: 4,
    streak: 5,
    longestStreak: 6,
    studyDays: seedStudyDays(),
    joinedAt: daysFromNow(-40, 10),
    mistakesCorrected: 7,
  };
}

export function seedTopicProgress(): TopicProgress[] {
  return [
    { topicId: "knowing-numbers", topicName: "Knowing Our Numbers", accuracy: 82, mastery: 84, attempts: 14, trend: "up" },
    { topicId: "whole-numbers", topicName: "Whole Numbers", accuracy: 58, mastery: 62, attempts: 11, trend: "up" },
    { topicId: "playing-numbers", topicName: "Playing with Numbers", accuracy: 88, mastery: 86, attempts: 16, trend: "up" },
    { topicId: "basic-geometry", topicName: "Basic Geometrical Ideas", accuracy: 68, mastery: 70, attempts: 9, trend: "flat" },
    { topicId: "elementary-shapes", topicName: "Understanding Elementary Shapes", accuracy: 75, mastery: 81, attempts: 8, trend: "up" },
    { topicId: "integers", topicName: "Integers", accuracy: 64, mastery: 45, attempts: 4, trend: "flat" },
    { topicId: "fractions", topicName: "Fractions", accuracy: 52, mastery: 30, attempts: 3, trend: "down" },
    { topicId: "decimals", topicName: "Decimals", accuracy: 0, mastery: 0, attempts: 0, trend: "flat" },
  ];
}

export function seedAchievements(): Achievement[] {
  return [
    { id: "first-mission", title: "First Mission", description: "Complete your first assignment.", icon: "rocket", category: "milestone", xpReward: 50, current: 1, target: 1, unlockedAt: daysFromNow(-24, 19) },
    { id: "three-day-spark", title: "Three-Day Spark", description: "Study for three days in a row.", icon: "flame", category: "consistency", xpReward: 40, current: 3, target: 3, unlockedAt: daysFromNow(-20, 19) },
    { id: "seven-day-champion", title: "Seven-Day Champion", description: "Keep a seven-day study streak.", icon: "trophy", category: "consistency", xpReward: 120, current: 5, target: 7 },
    { id: "accuracy-star", title: "Accuracy Star", description: "Score above 90% in homework or a 5+ question practice.", icon: "star", category: "accuracy", xpReward: 80, current: 88, target: 90 },
    { id: "comeback-hero", title: "Comeback Hero", description: "Improve your score by 20 percentage points.", icon: "trending-up", category: "improvement", xpReward: 100, current: 20, target: 20, unlockedAt: daysFromNow(-10, 19) },
    { id: "mistake-master", title: "Mistake Master", description: "Correct ten of your previous mistakes.", icon: "wrench", category: "improvement", xpReward: 100, current: 7, target: 10 },
    { id: "math-explorer", title: "Math Explorer", description: "Master five topics (80%+ mastery).", icon: "compass", category: "mastery", xpReward: 150, current: 3, target: 5 },
    { id: "practice-pro", title: "Practice Pro", description: "Finish five practice sessions.", icon: "target", category: "consistency", xpReward: 60, current: 3, target: 5 },
    { id: "early-bird", title: "Early Bird", description: "Submit three assignments before their due date.", icon: "sunrise", category: "consistency", xpReward: 60, current: 3, target: 3, unlockedAt: daysFromNow(-5, 19) },
  ];
}

export function seedRewards(): Reward[] {
  return [
    { id: "r1", title: "Choose a favourite dessert", description: "Pick any dessert for the weekend!", trigger: "streak", threshold: 7, status: "locked", emoji: "🍨", createdBy: "parent_1" },
    { id: "r2", title: "Small surprise", description: "A little surprise from Mumma & Papa.", trigger: "score", threshold: 90, status: "locked", emoji: "🎁", createdBy: "parent_1" },
    { id: "r3", title: "Special gift", description: "A special gift of your choice (within budget).", trigger: "streak", threshold: 30, status: "locked", emoji: "🏆", createdBy: "parent_2" },
    { id: "r4", title: "Extra appreciation reward", description: "A video call party + extra screen time.", trigger: "improvement", threshold: 20, status: "delivered", emoji: "🎉", createdBy: "parent_2", unlockedAt: daysFromNow(-10, 19), deliveredAt: daysFromNow(-8, 12) },
    { id: "r5", title: "New storybook", description: "Pick a new book from the bookstore.", trigger: "xp", threshold: 1000, status: "unlocked", emoji: "📚", createdBy: "parent_1", unlockedAt: daysFromNow(-4, 19) },
    { id: "r6", title: "Park outing", description: "A Sunday trip to the park.", trigger: "xp", threshold: 2000, status: "locked", emoji: "🌳", createdBy: "parent_2" },
  ];
}

export function seedXPEvents(): XPEvent[] {
  return [
    { id: "x1", label: "Measuring & Classifying Angles evaluated", xp: 80, at: daysFromNow(-2, 19), kind: "assignment" },
    { id: "x2", label: "Daily practice challenge", xp: 55, at: daysFromNow(-3, 18), kind: "practice" },
    { id: "x3", label: "HCF, LCM & Prime Factorisation evaluated", xp: 90, at: daysFromNow(-5, 19), kind: "assignment" },
    { id: "x4", label: "Badge: Early Bird", xp: 60, at: daysFromNow(-5, 19), kind: "achievement" },
    { id: "x5", label: "Corrected 2 mistakes", xp: 30, at: daysFromNow(-7, 18), kind: "correction" },
    { id: "x6", label: "Badge: Comeback Hero", xp: 100, at: daysFromNow(-10, 19), kind: "achievement" },
    { id: "x7", label: "Large Numbers & Estimation evaluated", xp: 86, at: daysFromNow(-10, 19), kind: "assignment" },
  ];
}

export function seedPracticeResults(): PracticeResult[] {
  return [
    {
      id: "p1",
      config: { subjectId: "mathematics", topicId: "playing-numbers", difficulty: "medium", count: 5, mode: "daily" },
      attempts: [],
      correct: 4,
      total: 5,
      xpEarned: 55,
      completedAt: daysFromNow(-3, 18),
    },
    {
      id: "p2",
      config: { subjectId: "mathematics", topicId: "whole-numbers", difficulty: "easy", count: 5, mode: "weak" },
      attempts: [],
      correct: 3,
      total: 5,
      xpEarned: 45,
      completedAt: daysFromNow(-8, 18),
    },
    {
      id: "p3",
      config: { subjectId: "mathematics", topicId: "knowing-numbers", difficulty: "medium", count: 5, mode: "custom" },
      attempts: [],
      correct: 4,
      total: 5,
      xpEarned: 55,
      completedAt: daysFromNow(-12, 18),
    },
  ];
}

export function seedReportSettings(): ReportSettings {
  return {
    enabled: true,
    day: "Sunday",
    time: "19:00",
    recipients: [
      { id: "parent_1", name: "Priya Sharma", email: "priya.parent@example.com", enabled: true },
      { id: "parent_2", name: "Rahul Sharma", email: "rahul.parent@example.com", enabled: true },
    ],
    includeTopicBreakdown: true,
    includeMistakes: true,
  };
}

export function seedNotificationPrefs(): NotificationPreferences {
  return {
    submissionEvaluated: true,
    deadlineReminders: true,
    streakAlerts: true,
    achievementUnlocked: true,
    weakTopicAlerts: false,
  };
}

export function seedAppPrefs(): AppPreferences {
  return { soundEffects: true, reducedMotion: false, showLeaderboardHints: true, aiHintLevel: "gentle", celebrations: true, autoUnlockRewards: true };
}

/** Archived reports for previous weeks (the current week is computed live). */
export function seedPastReports(): WeeklyReport[] {
  const thisWeek = startOfWeek();
  const mk = (weeksAgo: number, data: Omit<WeeklyReport, "id" | "weekStart" | "weekEnd">): WeeklyReport => {
    const start = addDays(thisWeek, -7 * weeksAgo);
    return { id: `w${weeksAgo}`, weekStart: start.toISOString(), weekEnd: addDays(start, 6).toISOString(), ...data };
  };
  return [
    mk(1, {
      averageScore: 85, previousAverageScore: 75, assignmentsCompleted: 2, assignmentsAssigned: 3, studyDays: 5, studyMinutes: 172, mistakesCorrected: 3,
      topicScores: [{ topic: "Playing with Numbers", score: 88 }, { topic: "Elementary Shapes", score: 75 }, { topic: "Knowing Our Numbers", score: 92 }],
      dailyMinutes: [{ day: "Mon", minutes: 35 }, { day: "Tue", minutes: 30 }, { day: "Wed", minutes: 0 }, { day: "Thu", minutes: 42 }, { day: "Fri", minutes: 25 }, { day: "Sat", minutes: 40 }, { day: "Sun", minutes: 0 }],
      highlights: ["Scored 88% on HCF & LCM", "Unlocked the Early Bird badge"],
      focusNextWeek: ["Identifying prime numbers", "Classifying triangles by angles"],
    }),
    mk(2, {
      averageScore: 75, previousAverageScore: 68, assignmentsCompleted: 1, assignmentsAssigned: 2, studyDays: 4, studyMinutes: 140, mistakesCorrected: 2,
      topicScores: [{ topic: "Knowing Our Numbers", score: 82 }, { topic: "Whole Numbers", score: 60 }],
      dailyMinutes: [{ day: "Mon", minutes: 30 }, { day: "Tue", minutes: 0 }, { day: "Wed", minutes: 45 }, { day: "Thu", minutes: 35 }, { day: "Fri", minutes: 0 }, { day: "Sat", minutes: 30 }, { day: "Sun", minutes: 0 }],
      highlights: ["Comeback Hero badge — +30 points improvement!"],
      focusNextWeek: ["Rounding to the nearest thousand", "Long multiplication carries"],
    }),
    mk(3, {
      averageScore: 68, previousAverageScore: 52, assignmentsCompleted: 1, assignmentsAssigned: 1, studyDays: 4, studyMinutes: 118, mistakesCorrected: 2,
      topicScores: [{ topic: "Basic Geometrical Ideas", score: 68 }],
      dailyMinutes: [{ day: "Mon", minutes: 20 }, { day: "Tue", minutes: 30 }, { day: "Wed", minutes: 28 }, { day: "Thu", minutes: 0 }, { day: "Fri", minutes: 40 }, { day: "Sat", minutes: 0 }, { day: "Sun", minutes: 0 }],
      highlights: ["Studied 4 days this week"],
      focusNextWeek: ["Counting line segments", "Parts of a circle"],
    }),
  ];
}

export function seedChat(): ChatMessage[] {
  return [
    {
      id: "c0",
      role: "buddy",
      text: `Hi ${DEMO_STUDENT_NAME}! I'm Arthu, your maths buddy. 🦉 I won't just tell you answers — I'll give you hints so YOU can crack it. What shall we explore today?`,
      at: daysFromNow(-1, 17),
    },
    { id: "c1", role: "student", text: "How do I find the LCM of 4 and 6?", at: daysFromNow(-1, 17) },
    {
      id: "c2",
      role: "buddy",
      text: "Great question! LCM means the Lowest Common Multiple.\n\nHint 1: Can you list the first few multiples of 4 and of 6? Look for a number that shows up in both lists.",
      at: daysFromNow(-1, 17),
    },
    { id: "c3", role: "student", text: "4, 8, 12 and 6, 12… so 12?", at: daysFromNow(-1, 17) },
    {
      id: "c4",
      role: "buddy",
      text: "YES! 🎉 12 is the first number in both lists, so LCM(4, 6) = 12. You found it yourself — that's how champions learn!",
      at: daysFromNow(-1, 17),
    },
  ];
}
