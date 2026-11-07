"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/client/store";
import { liveStatus } from "@/lib/client/assignment.service";
import { bestScore, improvementPoints } from "@/lib/client/progress-engine";
import { levelFromXP } from "@/lib/utils/gamification";
import type { Assignment, AssignmentStatus } from "@/types";

export const useStudent = () => useStore((db) => db.student);
export const useUsers = () => useStore((db) => db.users);
export const useAssignmentsRaw = () => useStore((db) => db.assignments);
export const useSubmissions = () => useStore((db) => db.submissions);
export const useEvaluations = () => useStore((db) => db.evaluations);
export const useTopicProgress = () => useStore((db) => db.topicProgress);
export const useAchievements = () => useStore((db) => db.achievements);
export const useRewards = () => useStore((db) => db.rewards);
export const useXPEvents = () => useStore((db) => db.xpEvents);
export const usePracticeResults = () => useStore((db) => db.practiceResults);
export const useChat = () => useStore((db) => db.chat);
export const useReportSettings = () => useStore((db) => db.reportSettings);
export const useNotificationPrefs = () => useStore((db) => db.notificationPrefs);
export const useAppPrefs = () => useStore((db) => db.appPrefs);
export const usePastReports = () => useStore((db) => db.pastReports);
export const useStudyMinutes = () => useStore((db) => db.studyMinutes);
export const useCelebrations = () => useStore((db) => db.celebrations);
export const useWholeDB = () => useStore((db) => db);

export type AssignmentView = Assignment & { live: AssignmentStatus };

export function useAssignments(): AssignmentView[] | undefined {
  const raw = useAssignmentsRaw();
  return useMemo(() => raw?.map((a) => ({ ...a, live: liveStatus(a) })), [raw]);
}

export function useLevel() {
  const student = useStudent();
  return useMemo(() => (student ? levelFromXP(student.xp) : undefined), [student]);
}

export function useScoreStats() {
  const evals = useEvaluations();
  const practice = usePracticeResults();
  return useMemo(() => {
    if (!evals || !practice) return undefined;
    return { best: bestScore(evals, practice), improvement: improvementPoints(evals) };
  }, [evals, practice]);
}
