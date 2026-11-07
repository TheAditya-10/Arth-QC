/**
 * Core domain types for Arth-QC.
 * These mirror the shape the Phase 2 backend (Neon PostgreSQL) is expected to return,
 * so mock services can be swapped for real API calls without touching UI code.
 */

export type ID = string;
export type ISODate = string; // ISO-8601 string

export type Role = "student" | "parent";

export type SubjectId = "mathematics" | "science" | "english";

export interface Subject {
  id: SubjectId;
  name: string;
  enabled: boolean;
  color: string;
}

export interface Topic {
  id: string;
  subjectId: SubjectId;
  name: string;
  chapter: number;
}

export type Difficulty = "easy" | "medium" | "hard";

export interface User {
  id: ID;
  name: string;
  email: string;
  role: Role;
  avatarColor: string;
  relation?: "Mother" | "Father" | "Guardian";
}

export interface StudentProfile {
  id: ID;
  userId: ID;
  name: string;
  grade: number;
  curriculum: "NCERT" | "CBSE" | "ICSE" | "State Board";
  school: string;
  subjects: SubjectId[];
  dailyGoalMinutes: number;
  xp: number;
  level: number;
  streak: number;
  longestStreak: number;
  /** ISO date strings (yyyy-mm-dd) of days the student studied */
  studyDays: string[];
  joinedAt: ISODate;
  mistakesCorrected: number;
}

export interface Question {
  id: ID;
  number: number;
  text: string;
  marks: number;
  /** Expected / model answer used for evaluation */
  expectedAnswer: string;
  /** Optional marking scheme hints, per step */
  markingSteps?: { description: string; marks: number }[];
  expectedSolution?: string;
}

export type AssignmentStatus = "pending" | "in_progress" | "submitted" | "evaluated" | "overdue";

export interface Assignment {
  id: ID;
  title: string;
  subjectId: SubjectId;
  topicId: string;
  grade: number;
  description: string;
  instructions: string[];
  questions: Question[];
  maxMarks: number;
  difficulty: Difficulty;
  estimatedMinutes: number;
  dueDate: ISODate;
  createdAt: ISODate;
  createdBy: ID;
  source: "manual" | "ai";
  markingScheme?: string;
  referenceFileName?: string;
  status: AssignmentStatus;
  attachments?: { id: ID; name: string; url: string }[];
  /** 0-100, used for "continue learning" */
  progress?: number;
}

export type UploadedFileKind = "image" | "pdf";

export interface UploadedFile {
  id: ID;
  name: string;
  kind: UploadedFileKind;
  size: number;
  /** data URL or remote URL. For mock data, an inline SVG data URL. */
  previewUrl: string;
}

export type EvaluationStatus = "processing" | "evaluated" | "reviewed" | "failed" | "needs_review";

export interface Submission {
  id: ID;
  assignmentId: ID;
  studentId: ID;
  submittedAt: ISODate;
  files: UploadedFile[];
  notes?: string;
  status: EvaluationStatus;
  evaluationId?: ID;
  /** Backend pipeline status (UPLOADED … COMPLETED). */
  rawStatus?: string;
  /** Last processing error (parents only). */
  jobError?: string;
}

export type ResultStatus = "correct" | "incorrect" | "partial";

export type ErrorKind = "conceptual" | "calculation" | "incomplete" | "notation" | "method" | "misread";

export interface StepMark {
  description: string;
  awarded: number;
  max: number;
  ok: boolean;
}

export interface QuestionFeedbackDetail {
  whatWentWrong: string;
  whyIncorrect: string;
  correctApproach: string;
  howToAvoid: string;
  example: string;
}

export interface QuestionResult {
  questionId: ID;
  /** Server id used for parent corrections. */
  questionEvaluationId?: ID;
  /** Marks originally given by the AI (unchanged by corrections). */
  aiMarks?: number;
  needsReview?: boolean;
  confidence?: number;
  feedback?: QuestionFeedbackDetail | null;
  recommendedPractice?: string[];
  verificationNote?: string;
  number: number;
  question: string;
  studentAnswer: string;
  expectedAnswer: string;
  marksAwarded: number;
  maxMarks: number;
  status: ResultStatus;
  steps: StepMark[];
  errors: { kind: ErrorKind; description: string }[];
  explanation: string;
}

export interface Evaluation {
  id: ID;
  submissionId: ID;
  assignmentId: ID;
  score: number;
  maxScore: number;
  xpEarned: number;
  evaluatedAt: ISODate;
  results: QuestionResult[];
  strengths: string[];
  needsAttention: string[];
  suggestedPractice: string[];
  summary: string;
  /** set when a parent manually adjusts marks */
  parentOverride?: { score: number; note: string; at: ISODate; originalScore: number };
  needsReview?: boolean;
  reviewReasons?: string[];
  confidence?: number;
  model?: string;
  promptVersion?: string;
  corrections?: { questionNumber: number; previousMarks: number; newMarks: number; reason: string; at: ISODate; by: string }[];
}

export interface TopicProgress {
  topicId: string;
  topicName: string;
  accuracy: number; // 0-100
  mastery: number; // 0-100
  attempts: number;
  trend: "up" | "down" | "flat";
  masteryLevel?: "NOT_STARTED" | "LEARNING" | "IMPROVING" | "PROFICIENT" | "MASTERED";
}

export type AchievementCategory = "consistency" | "improvement" | "accuracy" | "mastery" | "milestone";

export interface Achievement {
  id: ID;
  title: string;
  description: string;
  icon: string; // lucide icon name key in our icon map
  category: AchievementCategory;
  xpReward: number;
  /** progress toward unlock */
  current: number;
  target: number;
  unlockedAt?: ISODate;
}

export type RewardTrigger = "streak" | "xp" | "score" | "improvement" | "custom";

export type RewardStatus = "locked" | "unlocked" | "requested" | "approved" | "delivered";

export interface Reward {
  id: ID;
  title: string;
  description: string;
  trigger: RewardTrigger;
  /** threshold for the trigger, e.g. 7 (days), 1000 (xp), 90 (%) */
  threshold: number;
  status: RewardStatus;
  emoji: string;
  createdBy: ID;
  unlockedAt?: ISODate;
  deliveredAt?: ISODate;
  /** 0-100 progress toward the threshold (server-computed). */
  progress?: number;
  requestedAt?: ISODate;
}

export interface XPEvent {
  id: ID;
  label: string;
  xp: number;
  at: ISODate;
  kind: "assignment" | "practice" | "streak" | "achievement" | "correction";
}

export interface WeeklyReport {
  id: ID;
  weekStart: ISODate;
  weekEnd: ISODate;
  averageScore: number;
  previousAverageScore: number;
  assignmentsCompleted: number;
  assignmentsAssigned: number;
  studyDays: number;
  studyMinutes: number;
  mistakesCorrected: number;
  topicScores: { topic: string; score: number }[];
  dailyMinutes: { day: string; minutes: number }[];
  highlights: string[];
  focusNextWeek: string[];
}

export interface ReportSettings {
  enabled: boolean;
  day: "Sunday" | "Monday" | "Friday" | "Saturday";
  time: string; // HH:mm
  recipients: { id: ID; name: string; email: string; enabled: boolean }[];
  includeTopicBreakdown: boolean;
  includeMistakes: boolean;
}

export interface NotificationPreferences {
  submissionEvaluated: boolean;
  deadlineReminders: boolean;
  streakAlerts: boolean;
  achievementUnlocked: boolean;
  weakTopicAlerts: boolean;
}

export interface AppPreferences {
  soundEffects: boolean;
  reducedMotion: boolean;
  showLeaderboardHints: boolean;
  aiHintLevel: "gentle" | "standard" | "detailed";
  /** show celebration pop-ups when badges unlock */
  celebrations: boolean;
  /** automatically unlock parent rewards when their milestone is reached */
  autoUnlockRewards: boolean;
}

export interface PracticeQuestion {
  id: ID;
  topicId: string;
  difficulty: Difficulty;
  text: string;
  answer: string;
  /** alternative accepted answers (normalised compare) */
  accepts?: string[];
  hint: string;
  explanation: string;
}

export interface PracticeSessionConfig {
  subjectId: SubjectId;
  topicId: string | "mixed";
  difficulty: Difficulty;
  count: number;
  mode: "custom" | "daily" | "weak" | "revision" | "weekly";
}

export interface PracticeAttempt {
  questionId: ID;
  answer: string;
  correct: boolean;
}

export interface PracticeResult {
  id: ID;
  config: PracticeSessionConfig;
  attempts: PracticeAttempt[];
  correct: number;
  total: number;
  xpEarned: number;
  completedAt: ISODate;
  title?: string;
}

export interface ChatMessage {
  id: ID;
  role: "student" | "buddy";
  text: string;
  at: ISODate;
}

export interface PerformancePoint {
  label: string;
  score: number;
}

export interface Viewer {
  userId: ID;
  role: Role;
  name: string;
  email: string;
  familyId: ID;
  familyName: string;
  timezone: string;
  students: { id: ID; name: string; grade: number; username: string | null }[];
  activeStudentId: ID;
}

export interface LearningRecommendation {
  topicId: string;
  topicName: string;
  difficulty: Difficulty;
  reason: string;
}

export interface ReportHistoryItem extends WeeklyReport {
  status: "GENERATED" | "SENT" | "PARTIAL" | "FAILED";
  deliveries: { email: string; status: "QUEUED" | "SENT" | "FAILED" | "SKIPPED"; error: string | null; sentAt: ISODate | null; attempts: number }[];
}

export interface PendingInvitation {
  id: ID;
  email: string;
  expiresAt: ISODate;
}
