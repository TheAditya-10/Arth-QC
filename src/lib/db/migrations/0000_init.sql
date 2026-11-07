CREATE TYPE "public"."accuracy_level" AS ENUM('STRONG', 'ADEQUATE', 'NEEDS_IMPROVEMENT', 'NOT_DEMONSTRATED');--> statement-breakpoint
CREATE TYPE "public"."activity_type" AS ENUM('ASSIGNMENT_COMPLETED', 'PRACTICE_COMPLETED', 'MISTAKES_CORRECTED', 'REVISION_COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."assignment_source" AS ENUM('PARENT', 'AI', 'PRACTICE', 'REVISION');--> statement-breakpoint
CREATE TYPE "public"."assignment_status" AS ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."chat_role" AS ENUM('STUDENT', 'BUDDY');--> statement-breakpoint
CREATE TYPE "public"."difficulty" AS ENUM('EASY', 'MEDIUM', 'HARD');--> statement-breakpoint
CREATE TYPE "public"."email_status" AS ENUM('QUEUED', 'SENT', 'FAILED', 'SKIPPED');--> statement-breakpoint
CREATE TYPE "public"."evaluation_status" AS ENUM('UPLOADED', 'QUEUED', 'PROCESSING', 'EXTRACTING', 'EVALUATING', 'COMPLETED', 'FAILED', 'NEEDS_REVIEW');--> statement-breakpoint
CREATE TYPE "public"."final_answer_status" AS ENUM('CORRECT', 'INCORRECT', 'MISSING', 'UNREADABLE');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."mastery_level" AS ENUM('NOT_STARTED', 'LEARNING', 'IMPROVING', 'PROFICIENT', 'MASTERED');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('PARENT', 'STUDENT');--> statement-breakpoint
CREATE TYPE "public"."member_status" AS ENUM('ACTIVE', 'REMOVED');--> statement-breakpoint
CREATE TYPE "public"."mistake_status" AS ENUM('OPEN', 'CORRECTED');--> statement-breakpoint
CREATE TYPE "public"."practice_mode" AS ENUM('CUSTOM', 'DAILY', 'WEAK_TOPIC', 'REVISION', 'WEEKLY', 'MISTAKE_RETRY');--> statement-breakpoint
CREATE TYPE "public"."practice_status" AS ENUM('ACTIVE', 'COMPLETED', 'ABANDONED');--> statement-breakpoint
CREATE TYPE "public"."question_result" AS ENUM('CORRECT', 'PARTIAL', 'INCORRECT', 'UNANSWERED');--> statement-breakpoint
CREATE TYPE "public"."redemption_status" AS ENUM('REQUESTED', 'APPROVED', 'DECLINED', 'DELIVERED');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('GENERATED', 'SENT', 'PARTIAL', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."reward_trigger" AS ENUM('XP', 'STREAK', 'SCORE', 'IMPROVEMENT', 'CUSTOM');--> statement-breakpoint
CREATE TYPE "public"."rubric_source" AS ENUM('PARENT', 'AI_GENERATED');--> statement-breakpoint
CREATE TYPE "public"."step_status" AS ENUM('CORRECT', 'PARTIAL', 'INCORRECT', 'MISSING');--> statement-breakpoint
CREATE TYPE "public"."upload_purpose" AS ENUM('SUBMISSION', 'ASSIGNMENT_ATTACHMENT');--> statement-breakpoint
CREATE TYPE "public"."upload_status" AS ENUM('PENDING', 'UPLOADED', 'ATTACHED', 'DELETED');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('SUPER_ADMIN', 'PARENT', 'STUDENT');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_rate_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "auth_rate_limits_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"username" text,
	"display_username" text,
	"role" "user_role" DEFAULT 'PARENT' NOT NULL,
	"failed_login_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "families" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"timezone" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"xp_rules" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"auto_unlock_rewards" boolean DEFAULT true NOT NULL,
	"report_enabled" boolean DEFAULT true NOT NULL,
	"report_day" integer DEFAULT 0 NOT NULL,
	"report_time" text DEFAULT '19:00' NOT NULL,
	"report_include_topics" boolean DEFAULT true NOT NULL,
	"report_include_mistakes" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "family_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"email" text NOT NULL,
	"relation" text,
	"token_hash" text NOT NULL,
	"invited_by" uuid NOT NULL,
	"status" "invitation_status" DEFAULT 'PENDING' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_by" uuid,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "family_invitations_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "family_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "member_role" NOT NULL,
	"relation" text,
	"status" "member_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parent_student_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"parent_user_id" uuid NOT NULL,
	"student_profile_id" uuid NOT NULL,
	"relation" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"grade" integer DEFAULT 6 NOT NULL,
	"curriculum_id" uuid,
	"school" text DEFAULT '' NOT NULL,
	"daily_goal_minutes" integer DEFAULT 30 NOT NULL,
	"avatar_color" text DEFAULT '#FFD66B' NOT NULL,
	"xp_total" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "assignment_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" uuid NOT NULL,
	"upload_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assignment_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"question_text" text NOT NULL,
	"expected_answer" text NOT NULL,
	"expected_solution" text,
	"max_marks" numeric(6, 2) NOT NULL,
	"difficulty" "difficulty" DEFAULT 'MEDIUM' NOT NULL,
	"topic_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"student_profile_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"grade" integer NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"instructions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"difficulty" "difficulty" DEFAULT 'MEDIUM' NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"total_marks" integer NOT NULL,
	"estimated_minutes" integer DEFAULT 30 NOT NULL,
	"source" "assignment_source" DEFAULT 'PARENT' NOT NULL,
	"status" "assignment_status" DEFAULT 'PUBLISHED' NOT NULL,
	"marking_config" jsonb DEFAULT '{"allowAlternativeMethods":true,"partialCredit":true}'::jsonb NOT NULL,
	"created_by" uuid,
	"started_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "curriculum" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"board" text NOT NULL,
	"country" text DEFAULT 'IN' NOT NULL,
	CONSTRAINT "curriculum_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "marking_rubrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"source" "rubric_source" NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"steps" jsonb NOT NULL,
	"alternative_methods" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"expected_solution" text,
	"total_marks" numeric(6, 2) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"model" text,
	"prompt_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "subjects_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_id" uuid NOT NULL,
	"curriculum_id" uuid,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"grade" integer NOT NULL,
	"chapter" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evaluation_corrections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evaluation_id" uuid NOT NULL,
	"question_evaluation_id" uuid NOT NULL,
	"corrected_by" uuid NOT NULL,
	"previous_marks" numeric(6, 2) NOT NULL,
	"new_marks" numeric(6, 2) NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evaluation_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"job_key" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "evaluation_status" DEFAULT 'QUEUED' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 4 NOT NULL,
	"next_run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by" text,
	"last_error" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evaluation_jobs_job_key_unique" UNIQUE("job_key")
);
--> statement-breakpoint
CREATE TABLE "evaluation_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_evaluation_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"description" text NOT NULL,
	"awarded_marks" numeric(6, 2) NOT NULL,
	"max_marks" numeric(6, 2) NOT NULL,
	"status" "step_status" NOT NULL,
	"comment" text
);
--> statement-breakpoint
CREATE TABLE "evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"job_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	"ai_score" numeric(7, 2) NOT NULL,
	"score" numeric(7, 2) NOT NULL,
	"max_score" numeric(7, 2) NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"strengths" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"needs_attention" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"suggested_practice" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"confidence" real DEFAULT 0 NOT NULL,
	"needs_review" boolean DEFAULT false NOT NULL,
	"review_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"extraction" jsonb,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"xp_awarded" integer DEFAULT 0 NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question_evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evaluation_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"extracted_answer" text DEFAULT '' NOT NULL,
	"extracted_steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"expected_answer" text NOT NULL,
	"max_marks" numeric(6, 2) NOT NULL,
	"ai_marks" numeric(6, 2) NOT NULL,
	"awarded_marks" numeric(6, 2) NOT NULL,
	"result" "question_result" NOT NULL,
	"concept_accuracy" "accuracy_level" NOT NULL,
	"calculation_accuracy" "accuracy_level" NOT NULL,
	"final_answer_status" "final_answer_status" NOT NULL,
	"mistake_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"mistake_description" text,
	"explanation" text DEFAULT '' NOT NULL,
	"feedback" jsonb,
	"recommended_practice" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"confidence" real DEFAULT 0 NOT NULL,
	"needs_review" boolean DEFAULT false NOT NULL,
	"verification" jsonb
);
--> statement-breakpoint
CREATE TABLE "submission_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"upload_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"page_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "submission_files_upload_id_unique" UNIQUE("upload_id")
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" uuid NOT NULL,
	"student_profile_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"idempotency_key" text NOT NULL,
	"notes" text,
	"status" "evaluation_status" DEFAULT 'UPLOADED' NOT NULL,
	"is_late" boolean DEFAULT false NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "submissions_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"purpose" "upload_purpose" NOT NULL,
	"storage_key" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"declared_size" integer NOT NULL,
	"size_bytes" integer,
	"status" "upload_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verified_at" timestamp with time zone,
	CONSTRAINT "uploads_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "daily_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_profile_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"target_minutes" integer NOT NULL,
	"achieved_minutes" integer DEFAULT 0 NOT NULL,
	"completed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_profile_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"activity_type" "activity_type" NOT NULL,
	"source_type" text NOT NULL,
	"source_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"minutes" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mistake_notebook" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_profile_id" uuid NOT NULL,
	"topic_id" uuid,
	"question_evaluation_id" uuid,
	"question_text" text NOT NULL,
	"student_answer" text DEFAULT '' NOT NULL,
	"expected_answer" text NOT NULL,
	"mistake_type" text,
	"explanation" text DEFAULT '' NOT NULL,
	"status" "mistake_status" DEFAULT 'OPEN' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"corrected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mistake_notebook_question_evaluation_id_unique" UNIQUE("question_evaluation_id")
);
--> statement-breakpoint
CREATE TABLE "practice_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"answer" text NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_correct" boolean NOT NULL,
	"verification_method" text NOT NULL,
	"time_spent_seconds" integer DEFAULT 0 NOT NULL,
	"answered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "practice_answers_question_id_unique" UNIQUE("question_id")
);
--> statement-breakpoint
CREATE TABLE "practice_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"topic_id" uuid,
	"difficulty" "difficulty" NOT NULL,
	"question_text" text NOT NULL,
	"answer" text NOT NULL,
	"accepted_answers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"solution" text DEFAULT '' NOT NULL,
	"hint" text DEFAULT '' NOT NULL,
	"marks" integer DEFAULT 1 NOT NULL,
	"mistake_id" uuid
);
--> statement-breakpoint
CREATE TABLE "practice_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_profile_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"mode" "practice_mode" NOT NULL,
	"title" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"topic_id" uuid,
	"difficulty" "difficulty" NOT NULL,
	"status" "practice_status" DEFAULT 'ACTIVE' NOT NULL,
	"generated_by" text DEFAULT 'bank' NOT NULL,
	"source_evaluation_id" uuid,
	"question_count" integer NOT NULL,
	"correct_count" integer DEFAULT 0 NOT NULL,
	"xp_awarded" integer DEFAULT 0 NOT NULL,
	"time_spent_seconds" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "revision_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_profile_id" uuid NOT NULL,
	"practice_session_id" uuid,
	"topic_id" uuid,
	"reason" text NOT NULL,
	"status" text DEFAULT 'PLANNED' NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topic_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_profile_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"total_attempts" integer DEFAULT 0 NOT NULL,
	"correct_attempts" integer DEFAULT 0 NOT NULL,
	"accuracy" real DEFAULT 0 NOT NULL,
	"average_marks_pct" real DEFAULT 0 NOT NULL,
	"recent_scores" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"mastery_score" real DEFAULT 0 NOT NULL,
	"mastery_level" "mastery_level" DEFAULT 'NOT_STARTED' NOT NULL,
	"previous_mastery_score" real DEFAULT 0 NOT NULL,
	"repeated_errors" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"revision_count" integer DEFAULT 0 NOT NULL,
	"last_activity_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "achievements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"icon" text NOT NULL,
	"category" text NOT NULL,
	"xp_reward" integer DEFAULT 0 NOT NULL,
	"rule_type" text NOT NULL,
	"threshold" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "achievements_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "reward_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"student_profile_id" uuid,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"emoji" text DEFAULT '🎁' NOT NULL,
	"trigger_type" "reward_trigger" NOT NULL,
	"threshold" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reward_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reward_definition_id" uuid NOT NULL,
	"student_profile_id" uuid NOT NULL,
	"status" "redemption_status" DEFAULT 'REQUESTED' NOT NULL,
	"eligibility_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"delivered_by" uuid,
	"delivered_at" timestamp with time zone,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "student_achievements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_profile_id" uuid NOT NULL,
	"achievement_id" uuid NOT NULL,
	"unlocked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"celebrated_at" timestamp with time zone,
	"progress_value" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_streaks" (
	"student_profile_id" uuid PRIMARY KEY NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"longest_streak" integer DEFAULT 0 NOT NULL,
	"last_activity_date" date,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "xp_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_profile_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"rule_key" text NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_usage_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purpose" text NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"status" text NOT NULL,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"error" text,
	"reference_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "buddy_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_profile_id" uuid NOT NULL,
	"role" "chat_role" NOT NULL,
	"content" text NOT NULL,
	"model" text,
	"flagged" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_delivery_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid,
	"weekly_report_id" uuid,
	"template" text NOT NULL,
	"recipient_email" text NOT NULL,
	"subject" text NOT NULL,
	"provider_message_id" text,
	"status" "email_status" DEFAULT 'QUEUED' NOT NULL,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"submission_evaluated" boolean DEFAULT true NOT NULL,
	"deadline_reminders" boolean DEFAULT true NOT NULL,
	"streak_alerts" boolean DEFAULT true NOT NULL,
	"achievement_unlocked" boolean DEFAULT true NOT NULL,
	"weak_topic_alerts" boolean DEFAULT false NOT NULL,
	"app_preferences" jsonb DEFAULT '{"soundEffects":true,"showMotivation":true,"celebrations":true,"aiHintLevel":"gentle"}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "report_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_profile_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"week_start" date NOT NULL,
	"week_end" date NOT NULL,
	"timezone" text NOT NULL,
	"data" jsonb NOT NULL,
	"status" "report_status" DEFAULT 'GENERATED' NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_invitations" ADD CONSTRAINT "family_invitations_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_invitations" ADD CONSTRAINT "family_invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_invitations" ADD CONSTRAINT "family_invitations_accepted_by_users_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_student_links" ADD CONSTRAINT "parent_student_links_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_student_links" ADD CONSTRAINT "parent_student_links_parent_user_id_users_id_fk" FOREIGN KEY ("parent_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_student_links" ADD CONSTRAINT "parent_student_links_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."student_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_curriculum_id_curriculum_id_fk" FOREIGN KEY ("curriculum_id") REFERENCES "public"."curriculum"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_attachments" ADD CONSTRAINT "assignment_attachments_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_attachments" ADD CONSTRAINT "assignment_attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_questions" ADD CONSTRAINT "assignment_questions_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_questions" ADD CONSTRAINT "assignment_questions_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marking_rubrics" ADD CONSTRAINT "marking_rubrics_question_id_assignment_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."assignment_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_curriculum_id_curriculum_id_fk" FOREIGN KEY ("curriculum_id") REFERENCES "public"."curriculum"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_corrections" ADD CONSTRAINT "evaluation_corrections_evaluation_id_evaluations_id_fk" FOREIGN KEY ("evaluation_id") REFERENCES "public"."evaluations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_corrections" ADD CONSTRAINT "evaluation_corrections_question_evaluation_id_question_evaluations_id_fk" FOREIGN KEY ("question_evaluation_id") REFERENCES "public"."question_evaluations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_corrections" ADD CONSTRAINT "evaluation_corrections_corrected_by_users_id_fk" FOREIGN KEY ("corrected_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_jobs" ADD CONSTRAINT "evaluation_jobs_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_steps" ADD CONSTRAINT "evaluation_steps_question_evaluation_id_question_evaluations_id_fk" FOREIGN KEY ("question_evaluation_id") REFERENCES "public"."question_evaluations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_job_id_evaluation_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."evaluation_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_evaluations" ADD CONSTRAINT "question_evaluations_evaluation_id_evaluations_id_fk" FOREIGN KEY ("evaluation_id") REFERENCES "public"."evaluations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_evaluations" ADD CONSTRAINT "question_evaluations_question_id_assignment_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."assignment_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_files" ADD CONSTRAINT "submission_files_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_files" ADD CONSTRAINT "submission_files_upload_id_uploads_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."uploads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."student_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_goals" ADD CONSTRAINT "daily_goals_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."student_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_activity_logs" ADD CONSTRAINT "learning_activity_logs_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."student_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mistake_notebook" ADD CONSTRAINT "mistake_notebook_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."student_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mistake_notebook" ADD CONSTRAINT "mistake_notebook_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mistake_notebook" ADD CONSTRAINT "mistake_notebook_question_evaluation_id_question_evaluations_id_fk" FOREIGN KEY ("question_evaluation_id") REFERENCES "public"."question_evaluations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_answers" ADD CONSTRAINT "practice_answers_session_id_practice_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."practice_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_answers" ADD CONSTRAINT "practice_answers_question_id_practice_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."practice_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_questions" ADD CONSTRAINT "practice_questions_session_id_practice_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."practice_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_questions" ADD CONSTRAINT "practice_questions_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_sessions" ADD CONSTRAINT "practice_sessions_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."student_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_sessions" ADD CONSTRAINT "practice_sessions_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_sessions" ADD CONSTRAINT "practice_sessions_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_sessions" ADD CONSTRAINT "practice_sessions_source_evaluation_id_evaluations_id_fk" FOREIGN KEY ("source_evaluation_id") REFERENCES "public"."evaluations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revision_sessions" ADD CONSTRAINT "revision_sessions_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."student_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revision_sessions" ADD CONSTRAINT "revision_sessions_practice_session_id_practice_sessions_id_fk" FOREIGN KEY ("practice_session_id") REFERENCES "public"."practice_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revision_sessions" ADD CONSTRAINT "revision_sessions_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_progress" ADD CONSTRAINT "topic_progress_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."student_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_progress" ADD CONSTRAINT "topic_progress_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_definitions" ADD CONSTRAINT "reward_definitions_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_definitions" ADD CONSTRAINT "reward_definitions_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."student_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_definitions" ADD CONSTRAINT "reward_definitions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_reward_definition_id_reward_definitions_id_fk" FOREIGN KEY ("reward_definition_id") REFERENCES "public"."reward_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."student_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_delivered_by_users_id_fk" FOREIGN KEY ("delivered_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_achievements" ADD CONSTRAINT "student_achievements_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."student_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_achievements" ADD CONSTRAINT "student_achievements_achievement_id_achievements_id_fk" FOREIGN KEY ("achievement_id") REFERENCES "public"."achievements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_streaks" ADD CONSTRAINT "student_streaks_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."student_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xp_transactions" ADD CONSTRAINT "xp_transactions_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."student_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buddy_messages" ADD CONSTRAINT "buddy_messages_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."student_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_delivery_logs" ADD CONSTRAINT "email_delivery_logs_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_delivery_logs" ADD CONSTRAINT "email_delivery_logs_weekly_report_id_weekly_reports_id_fk" FOREIGN KEY ("weekly_report_id") REFERENCES "public"."weekly_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_recipients" ADD CONSTRAINT "report_recipients_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_recipients" ADD CONSTRAINT "report_recipients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_reports" ADD CONSTRAINT "weekly_reports_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."student_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_reports" ADD CONSTRAINT "weekly_reports_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "family_invitations_family_idx" ON "family_invitations" USING btree ("family_id");--> statement-breakpoint
CREATE UNIQUE INDEX "family_members_family_user_uq" ON "family_members" USING btree ("family_id","user_id");--> statement-breakpoint
CREATE INDEX "family_members_user_idx" ON "family_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "parent_student_links_uq" ON "parent_student_links" USING btree ("parent_user_id","student_profile_id");--> statement-breakpoint
CREATE INDEX "parent_student_links_student_idx" ON "parent_student_links" USING btree ("student_profile_id");--> statement-breakpoint
CREATE INDEX "student_profiles_family_idx" ON "student_profiles" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "assignment_attachments_assignment_idx" ON "assignment_attachments" USING btree ("assignment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "assignment_questions_position_uq" ON "assignment_questions" USING btree ("assignment_id","position");--> statement-breakpoint
CREATE INDEX "assignments_student_due_idx" ON "assignments" USING btree ("student_profile_id","due_at");--> statement-breakpoint
CREATE INDEX "assignments_family_idx" ON "assignments" USING btree ("family_id");--> statement-breakpoint
CREATE UNIQUE INDEX "marking_rubrics_question_version_uq" ON "marking_rubrics" USING btree ("question_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "topics_subject_code_grade_uq" ON "topics" USING btree ("subject_id","code","grade");--> statement-breakpoint
CREATE INDEX "evaluation_corrections_eval_idx" ON "evaluation_corrections" USING btree ("evaluation_id");--> statement-breakpoint
CREATE INDEX "evaluation_jobs_status_next_idx" ON "evaluation_jobs" USING btree ("status","next_run_at");--> statement-breakpoint
CREATE INDEX "evaluation_steps_qe_idx" ON "evaluation_steps" USING btree ("question_evaluation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "evaluations_submission_version_uq" ON "evaluations" USING btree ("submission_id","version");--> statement-breakpoint
CREATE INDEX "evaluations_submission_idx" ON "evaluations" USING btree ("submission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "question_evaluations_uq" ON "question_evaluations" USING btree ("evaluation_id","question_id");--> statement-breakpoint
CREATE INDEX "submission_files_submission_idx" ON "submission_files" USING btree ("submission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "submissions_attempt_uq" ON "submissions" USING btree ("assignment_id","student_profile_id","attempt_number");--> statement-breakpoint
CREATE INDEX "submissions_student_idx" ON "submissions" USING btree ("student_profile_id","submitted_at");--> statement-breakpoint
CREATE INDEX "submissions_family_idx" ON "submissions" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "uploads_owner_status_idx" ON "uploads" USING btree ("owner_user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_goals_uq" ON "daily_goals" USING btree ("student_profile_id","local_date");--> statement-breakpoint
CREATE UNIQUE INDEX "learning_activity_source_uq" ON "learning_activity_logs" USING btree ("activity_type","source_type","source_id");--> statement-breakpoint
CREATE INDEX "learning_activity_student_date_idx" ON "learning_activity_logs" USING btree ("student_profile_id","local_date");--> statement-breakpoint
CREATE INDEX "mistake_notebook_student_status_idx" ON "mistake_notebook" USING btree ("student_profile_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "practice_questions_position_uq" ON "practice_questions" USING btree ("session_id","position");--> statement-breakpoint
CREATE INDEX "practice_sessions_student_idx" ON "practice_sessions" USING btree ("student_profile_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "topic_progress_uq" ON "topic_progress" USING btree ("student_profile_id","topic_id");--> statement-breakpoint
CREATE INDEX "reward_definitions_family_idx" ON "reward_definitions" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "reward_redemptions_reward_idx" ON "reward_redemptions" USING btree ("reward_definition_id","student_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "student_achievements_uq" ON "student_achievements" USING btree ("student_profile_id","achievement_id");--> statement-breakpoint
CREATE UNIQUE INDEX "xp_transactions_idem_uq" ON "xp_transactions" USING btree ("student_profile_id","rule_key","source_type","source_id");--> statement-breakpoint
CREATE INDEX "xp_transactions_student_idx" ON "xp_transactions" USING btree ("student_profile_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_usage_logs_created_idx" ON "ai_usage_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_family_idx" ON "audit_logs" USING btree ("family_id","created_at");--> statement-breakpoint
CREATE INDEX "buddy_messages_student_idx" ON "buddy_messages" USING btree ("student_profile_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "email_delivery_report_recipient_uq" ON "email_delivery_logs" USING btree ("weekly_report_id","recipient_email");--> statement-breakpoint
CREATE INDEX "email_delivery_family_idx" ON "email_delivery_logs" USING btree ("family_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "report_recipients_family_email_uq" ON "report_recipients" USING btree ("family_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "weekly_reports_student_week_uq" ON "weekly_reports" USING btree ("student_profile_id","week_start");