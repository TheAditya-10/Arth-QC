/** Reference data shared by every family. Upserted idempotently by `npm run db:seed`. */

export const SUBJECTS = [
  { code: "mathematics", name: "Mathematics", enabled: true, sortOrder: 1 },
  { code: "science", name: "Science", enabled: false, sortOrder: 2 },
  { code: "english", name: "English", enabled: false, sortOrder: 3 },
];

export const CURRICULA = [
  { code: "NCERT", name: "NCERT", board: "CBSE" },
  { code: "CBSE", name: "CBSE", board: "CBSE" },
  { code: "ICSE", name: "ICSE", board: "CISCE" },
  { code: "State Board", name: "State Board", board: "State" },
];

/** Class 6 NCERT Mathematics chapters. `code` matches the Phase 1 topic ids. */
export const MATH_TOPICS_G6 = [
  { code: "knowing-numbers", name: "Knowing Our Numbers", chapter: 1 },
  { code: "whole-numbers", name: "Whole Numbers", chapter: 2 },
  { code: "playing-numbers", name: "Playing with Numbers", chapter: 3 },
  { code: "basic-geometry", name: "Basic Geometrical Ideas", chapter: 4 },
  { code: "elementary-shapes", name: "Understanding Elementary Shapes", chapter: 5 },
  { code: "integers", name: "Integers", chapter: 6 },
  { code: "fractions", name: "Fractions", chapter: 7 },
  { code: "decimals", name: "Decimals", chapter: 8 },
];

/**
 * Achievement definitions. `ruleType` selects the metric computed server-side in
 * services/gamification/achievements.ts.
 */
export const ACHIEVEMENTS = [
  { code: "first-mission", title: "First Mission", description: "Complete your first assignment.", icon: "rocket", category: "milestone", xpReward: 50, ruleType: "assignments_completed", threshold: 1 },
  { code: "three-day-spark", title: "Three-Day Spark", description: "Study for three days in a row.", icon: "flame", category: "consistency", xpReward: 40, ruleType: "streak", threshold: 3 },
  { code: "seven-day-champion", title: "Seven-Day Champion", description: "Keep a seven-day study streak.", icon: "trophy", category: "consistency", xpReward: 120, ruleType: "streak", threshold: 7 },
  { code: "thirty-day-legend", title: "Thirty-Day Legend", description: "Keep a thirty-day study streak.", icon: "trophy", category: "consistency", xpReward: 300, ruleType: "streak", threshold: 30 },
  { code: "accuracy-star", title: "Accuracy Star", description: "Score above 90% on a homework assignment.", icon: "star", category: "accuracy", xpReward: 80, ruleType: "best_homework_score", threshold: 91 },
  { code: "comeback-hero", title: "Comeback Hero", description: "Improve your score by 20 percentage points.", icon: "trending-up", category: "improvement", xpReward: 100, ruleType: "improvement_points", threshold: 20 },
  { code: "mistake-master", title: "Mistake Master", description: "Correct ten of your previous mistakes.", icon: "wrench", category: "improvement", xpReward: 100, ruleType: "mistakes_corrected", threshold: 10 },
  { code: "math-explorer", title: "Math Explorer", description: "Master five topics.", icon: "compass", category: "mastery", xpReward: 150, ruleType: "topics_mastered", threshold: 5 },
  { code: "practice-pro", title: "Practice Pro", description: "Finish five practice sessions.", icon: "target", category: "consistency", xpReward: 60, ruleType: "practice_sessions", threshold: 5 },
];
