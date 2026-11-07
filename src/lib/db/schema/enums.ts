import { pgEnum } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["SUPER_ADMIN", "PARENT", "STUDENT"]);
export const memberRoleEnum = pgEnum("member_role", ["PARENT", "STUDENT"]);
export const memberStatusEnum = pgEnum("member_status", ["ACTIVE", "REMOVED"]);
export const invitationStatusEnum = pgEnum("invitation_status", ["PENDING", "ACCEPTED", "REVOKED", "EXPIRED"]);
export const difficultyEnum = pgEnum("difficulty", ["EASY", "MEDIUM", "HARD"]);
export const assignmentSourceEnum = pgEnum("assignment_source", ["PARENT", "AI", "PRACTICE", "REVISION"]);
export const assignmentStatusEnum = pgEnum("assignment_status", ["DRAFT", "PUBLISHED", "ARCHIVED"]);
export const rubricSourceEnum = pgEnum("rubric_source", ["PARENT", "AI_GENERATED"]);
export const uploadPurposeEnum = pgEnum("upload_purpose", ["SUBMISSION", "ASSIGNMENT_ATTACHMENT"]);
export const uploadStatusEnum = pgEnum("upload_status", ["PENDING", "UPLOADED", "ATTACHED", "DELETED"]);
export const evaluationStatusEnum = pgEnum("evaluation_status", [
  "UPLOADED",
  "QUEUED",
  "PROCESSING",
  "EXTRACTING",
  "EVALUATING",
  "COMPLETED",
  "FAILED",
  "NEEDS_REVIEW",
]);
export const questionResultEnum = pgEnum("question_result", ["CORRECT", "PARTIAL", "INCORRECT", "UNANSWERED"]);
export const accuracyLevelEnum = pgEnum("accuracy_level", ["STRONG", "ADEQUATE", "NEEDS_IMPROVEMENT", "NOT_DEMONSTRATED"]);
export const finalAnswerStatusEnum = pgEnum("final_answer_status", ["CORRECT", "INCORRECT", "MISSING", "UNREADABLE"]);
export const stepStatusEnum = pgEnum("step_status", ["CORRECT", "PARTIAL", "INCORRECT", "MISSING"]);
export const practiceModeEnum = pgEnum("practice_mode", ["CUSTOM", "DAILY", "WEAK_TOPIC", "REVISION", "WEEKLY", "MISTAKE_RETRY"]);
export const practiceStatusEnum = pgEnum("practice_status", ["ACTIVE", "COMPLETED", "ABANDONED"]);
export const masteryLevelEnum = pgEnum("mastery_level", ["NOT_STARTED", "LEARNING", "IMPROVING", "PROFICIENT", "MASTERED"]);
export const mistakeStatusEnum = pgEnum("mistake_status", ["OPEN", "CORRECTED"]);
export const activityTypeEnum = pgEnum("activity_type", [
  "ASSIGNMENT_COMPLETED",
  "PRACTICE_COMPLETED",
  "MISTAKES_CORRECTED",
  "REVISION_COMPLETED",
]);
export const rewardTriggerEnum = pgEnum("reward_trigger", ["XP", "STREAK", "SCORE", "IMPROVEMENT", "CUSTOM"]);
export const redemptionStatusEnum = pgEnum("redemption_status", ["REQUESTED", "APPROVED", "DECLINED", "DELIVERED"]);
export const reportStatusEnum = pgEnum("report_status", ["GENERATED", "SENT", "PARTIAL", "FAILED"]);
export const emailStatusEnum = pgEnum("email_status", ["QUEUED", "SENT", "FAILED", "SKIPPED"]);
export const chatRoleEnum = pgEnum("chat_role", ["STUDENT", "BUDDY"]);
