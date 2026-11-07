"use client";

/**
 * In-browser demo database.
 *
 * Phase 1 keeps all application state in this store and persists it to
 * localStorage. Every read/write from the UI goes through the service modules
 * in this folder, so Phase 2 can replace them with real API calls
 * (Neon PostgreSQL + Gemini) without changing components.
 */
import { useSyncExternalStore } from "react";
import type {
  Achievement,
  AppPreferences,
  Assignment,
  ChatMessage,
  Evaluation,
  NotificationPreferences,
  PracticeResult,
  ReportSettings,
  Reward,
  StudentProfile,
  Submission,
  TopicProgress,
  User,
  WeeklyReport,
  XPEvent,
} from "@/types";
import { seedAssignments } from "@/lib/mock-data/assignments";
import { seedEvaluations, seedSubmissions } from "@/lib/mock-data/evaluations";
import {
  seedAchievements,
  seedAppPrefs,
  seedChat,
  seedNotificationPrefs,
  seedPastReports,
  seedPracticeResults,
  seedReportSettings,
  seedRewards,
  seedStudent,
  seedTopicProgress,
  seedUsers,
  seedXPEvents,
} from "@/lib/mock-data/profile";
import { applyProgress } from "./progress-engine";

export const DB_VERSION = 4;
const STORAGE_KEY = "arthqc.demo.db";

export interface DemoDB {
  version: number;
  seededAt: string;
  users: User[];
  student: StudentProfile;
  assignments: Assignment[];
  submissions: Submission[];
  evaluations: Evaluation[];
  topicProgress: TopicProgress[];
  achievements: Achievement[];
  rewards: Reward[];
  xpEvents: XPEvent[];
  practiceResults: PracticeResult[];
  pastReports: WeeklyReport[];
  reportSettings: ReportSettings & { lastSentAt?: string };
  notificationPrefs: NotificationPreferences;
  appPrefs: AppPreferences;
  chat: ChatMessage[];
  /** Achievement ids waiting to be celebrated in the student UI */
  celebrations: string[];
  /** minutes studied per day (yyyy-mm-dd) */
  studyMinutes: Record<string, number>;
}

export function createSeed(): DemoDB {
  const student = seedStudent();
  const studyMinutes: Record<string, number> = {};
  student.studyDays.forEach((d, i) => {
    studyMinutes[d] = 20 + ((i * 17) % 28);
  });
  return {
    version: DB_VERSION,
    seededAt: new Date().toISOString(),
    users: seedUsers(),
    student,
    assignments: seedAssignments(),
    submissions: seedSubmissions(),
    evaluations: seedEvaluations(),
    topicProgress: seedTopicProgress(),
    achievements: seedAchievements(),
    rewards: seedRewards(),
    xpEvents: seedXPEvents(),
    practiceResults: seedPracticeResults(),
    pastReports: seedPastReports(),
    reportSettings: seedReportSettings(),
    notificationPrefs: seedNotificationPrefs(),
    appPrefs: seedAppPrefs(),
    chat: seedChat(),
    celebrations: [],
    studyMinutes,
  };
}

let state: DemoDB | null = null;
const listeners = new Set<() => void>();

function load(): DemoDB {
  if (typeof window === "undefined") return createSeed();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoDB;
      if (parsed.version === DB_VERSION) return parsed;
    }
  } catch {
    // corrupted storage – fall back to seed
  }
  return createSeed();
}

function persist(db: DemoDB) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // Quota exceeded (large image uploads). Drop user-uploaded previews and retry.
    try {
      const slim: DemoDB = {
        ...db,
        submissions: db.submissions.map((s) => ({
          ...s,
          files: s.files.map((f) => (f.previewUrl.startsWith("data:image/svg") ? f : { ...f, previewUrl: "" })),
        })),
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
    } catch {
      // give up silently; in-memory state still works for this session
    }
  }
}

export function getDB(): DemoDB {
  if (!state) state = applyProgress(load());
  return state;
}

export function setDB(updater: (db: DemoDB) => DemoDB) {
  state = updater(getDB());
  persist(state);
  listeners.forEach((l) => l());
}

export function resetDB() {
  state = applyProgress(createSeed());
  persist(state);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      state = load();
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * Subscribe to a slice of the demo DB. Returns `undefined` during server
 * rendering / hydration so pages can show loading skeletons.
 *
 * The selector must return a reference stored in the DB (not a newly built
 * array/object) — derive data with `useMemo` in the component instead.
 */
export function useStore<T>(selector: (db: DemoDB) => T): T | undefined {
  return useSyncExternalStore(
    subscribe,
    () => selector(getDB()),
    () => undefined,
  );
}
