export const XP_PER_LEVEL = 400;

const LEVEL_TITLES = [
  "Number Rookie",
  "Count Captain",
  "Pattern Spotter",
  "Shape Scout",
  "Fraction Fighter",
  "Decimal Detective",
  "Integer Explorer",
  "Math Voyager",
  "Logic Legend",
  "Arth Grandmaster",
];

export function levelFromXP(xp: number) {
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const into = xp % XP_PER_LEVEL;
  return {
    level,
    title: LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)],
    xpIntoLevel: into,
    xpForNext: XP_PER_LEVEL,
    progress: Math.round((into / XP_PER_LEVEL) * 100),
    nextLevelAt: level * XP_PER_LEVEL,
  };
}

export function xpForEvaluation(percentage: number): number {
  return Math.round(20 + percentage * 0.8);
}

export function xpForPractice(correct: number, total: number): number {
  return correct * 10 + (total > 0 ? 15 : 0) + (correct === total && total >= 5 ? 25 : 0);
}

export function performanceMessage(percentage: number): { title: string; tone: "great" | "good" | "keep" } {
  if (percentage >= 90) return { title: "Outstanding work! You're a star.", tone: "great" };
  if (percentage >= 75) return { title: "Great progress! Keep practising.", tone: "great" };
  if (percentage >= 55) return { title: "Good effort! A few things to polish.", tone: "good" };
  return { title: "Every mistake is a step forward. Let's fix them together!", tone: "keep" };
}
