import { boolean, date, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { families, studentProfiles } from "./family";
import { redemptionStatusEnum, rewardTriggerEnum } from "./enums";

export const studentStreaks = pgTable("student_streaks", {
  studentProfileId: uuid("student_profile_id")
    .primaryKey()
    .references(() => studentProfiles.id, { onDelete: "cascade" }),
  currentStreak: integer("current_streak").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  lastActivityDate: date("last_activity_date", { mode: "string" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Append-only XP ledger. The unique key makes every award idempotent. */
export const xpTransactions = pgTable(
  "xp_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentProfileId: uuid("student_profile_id")
      .notNull()
      .references(() => studentProfiles.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    ruleKey: text("rule_key").notNull(),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id").notNull(),
    description: text("description").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("xp_transactions_idem_uq").on(t.studentProfileId, t.ruleKey, t.sourceType, t.sourceId),
    index("xp_transactions_student_idx").on(t.studentProfileId, t.createdAt),
  ],
);

export const achievements = pgTable("achievements", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(),
  category: text("category").notNull(),
  xpReward: integer("xp_reward").notNull().default(0),
  /** Which metric the rule reads (see gamification/achievements.ts). */
  ruleType: text("rule_type").notNull(),
  threshold: integer("threshold").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

export const studentAchievements = pgTable(
  "student_achievements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentProfileId: uuid("student_profile_id")
      .notNull()
      .references(() => studentProfiles.id, { onDelete: "cascade" }),
    achievementId: uuid("achievement_id")
      .notNull()
      .references(() => achievements.id, { onDelete: "cascade" }),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true }).notNull().defaultNow(),
    celebratedAt: timestamp("celebrated_at", { withTimezone: true }),
    progressValue: integer("progress_value").notNull().default(0),
  },
  (t) => [uniqueIndex("student_achievements_uq").on(t.studentProfileId, t.achievementId)],
);

export const rewardDefinitions = pgTable(
  "reward_definitions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    studentProfileId: uuid("student_profile_id").references(() => studentProfiles.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    emoji: text("emoji").notNull().default("🎁"),
    triggerType: rewardTriggerEnum("trigger_type").notNull(),
    threshold: integer("threshold").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("reward_definitions_family_idx").on(t.familyId)],
);

export const rewardRedemptions = pgTable(
  "reward_redemptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rewardDefinitionId: uuid("reward_definition_id")
      .notNull()
      .references(() => rewardDefinitions.id, { onDelete: "cascade" }),
    studentProfileId: uuid("student_profile_id")
      .notNull()
      .references(() => studentProfiles.id, { onDelete: "cascade" }),
    status: redemptionStatusEnum("status").notNull().default("REQUESTED"),
    /** Snapshot of the metric when eligibility was confirmed. */
    eligibilitySnapshot: jsonb("eligibility_snapshot").$type<Record<string, number>>().notNull().default({}),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    decidedBy: uuid("decided_by").references(() => users.id, { onDelete: "set null" }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    deliveredBy: uuid("delivered_by").references(() => users.id, { onDelete: "set null" }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    note: text("note"),
  },
  (t) => [index("reward_redemptions_reward_idx").on(t.rewardDefinitionId, t.studentProfileId)],
);
