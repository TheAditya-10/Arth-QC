-- Integrity constraints that Drizzle's table builder does not express directly.
ALTER TABLE "assignment_questions" ADD CONSTRAINT "assignment_questions_marks_ck" CHECK ("max_marks" > 0);
--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_total_marks_ck" CHECK ("total_marks" > 0);
--> statement-breakpoint
ALTER TABLE "question_evaluations" ADD CONSTRAINT "question_evaluations_marks_ck" CHECK ("awarded_marks" >= 0 AND "awarded_marks" <= "max_marks" AND "ai_marks" >= 0 AND "ai_marks" <= "max_marks");
--> statement-breakpoint
ALTER TABLE "evaluation_steps" ADD CONSTRAINT "evaluation_steps_marks_ck" CHECK ("awarded_marks" >= 0 AND "awarded_marks" <= "max_marks");
--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_score_ck" CHECK ("score" >= 0 AND "score" <= "max_score" AND "ai_score" >= 0 AND "ai_score" <= "max_score");
--> statement-breakpoint
ALTER TABLE "evaluation_corrections" ADD CONSTRAINT "evaluation_corrections_reason_ck" CHECK (length(trim("reason")) >= 3);
--> statement-breakpoint
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_grade_ck" CHECK ("grade" BETWEEN 1 AND 12);
--> statement-breakpoint
ALTER TABLE "student_streaks" ADD CONSTRAINT "student_streaks_ck" CHECK ("current_streak" >= 0 AND "longest_streak" >= "current_streak");
--> statement-breakpoint
ALTER TABLE "families" ADD CONSTRAINT "families_report_day_ck" CHECK ("report_day" BETWEEN 0 AND 6 AND "report_time" ~ '^[0-2][0-9]:[0-5][0-9]$');
--> statement-breakpoint
-- At most one open (requested/approved) redemption per reward and student.
CREATE UNIQUE INDEX "reward_redemptions_open_uq" ON "reward_redemptions" ("reward_definition_id", "student_profile_id") WHERE "status" IN ('REQUESTED', 'APPROVED');
--> statement-breakpoint
-- Only one current evaluation per submission.
CREATE UNIQUE INDEX "evaluations_current_uq" ON "evaluations" ("submission_id") WHERE "is_current";
--> statement-breakpoint
-- One pending invitation per family and email.
CREATE UNIQUE INDEX "family_invitations_pending_uq" ON "family_invitations" ("family_id", lower("email")) WHERE "status" = 'PENDING';
