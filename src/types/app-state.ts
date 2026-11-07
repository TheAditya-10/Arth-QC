import type {
  Achievement,
  AppPreferences,
  Assignment,
  ChatMessage,
  Evaluation,
  LearningRecommendation,
  NotificationPreferences,
  PendingInvitation,
  PracticeResult,
  ReportHistoryItem,
  ReportSettings,
  Reward,
  StudentProfile,
  Submission,
  TopicProgress,
  User,
  Viewer,
  WeeklyReport,
  XPEvent,
} from "./index";

/**
 * Everything a screen needs, in the exact shapes the Phase 1 UI was built on.
 * All values are computed from database records for the authorised student.
 */
export interface AppState {
  version: number;
  viewer: Viewer;
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
  pastReports: ReportHistoryItem[];
  currentReport: WeeklyReport | null;
  reportSettings: ReportSettings & { lastSentAt?: string };
  notificationPrefs: NotificationPreferences;
  appPrefs: AppPreferences;
  chat: ChatMessage[];
  celebrations: string[];
  studyMinutes: Record<string, number>;
  recommendations: LearningRecommendation[];
  invitations: PendingInvitation[];
}

