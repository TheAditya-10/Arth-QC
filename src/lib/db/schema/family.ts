import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { invitationStatusEnum, memberRoleEnum, memberStatusEnum } from "./enums";
import { curricula } from "./academic";

export type XpRuleOverrides = Partial<Record<string, number>>;

export const families = pgTable("families", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  /** Overrides for configurable XP rules (see lib/services/gamification/rules.ts) */
  xpRules: jsonb("xp_rules").$type<XpRuleOverrides>().notNull().default({}),
  autoUnlockRewards: boolean("auto_unlock_rewards").notNull().default(true),
  reportEnabled: boolean("report_enabled").notNull().default(true),
  /** 0 = Sunday … 6 = Saturday, in the family's timezone */
  reportDay: integer("report_day").notNull().default(0),
  /** HH:mm in the family's timezone */
  reportTime: text("report_time").notNull().default("19:00"),
  reportIncludeTopics: boolean("report_include_topics").notNull().default(true),
  reportIncludeMistakes: boolean("report_include_mistakes").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const familyMembers = pgTable(
  "family_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: memberRoleEnum("role").notNull(),
    relation: text("relation"),
    status: memberStatusEnum("status").notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("family_members_family_user_uq").on(t.familyId, t.userId), index("family_members_user_idx").on(t.userId)],
);

export const studentProfiles = pgTable(
  "student_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    grade: integer("grade").notNull().default(6),
    curriculumId: uuid("curriculum_id").references(() => curricula.id),
    school: text("school").notNull().default(""),
    dailyGoalMinutes: integer("daily_goal_minutes").notNull().default(30),
    avatarColor: text("avatar_color").notNull().default("#FFD66B"),
    /** Denormalised sum of xp_transactions, maintained in the same transaction. */
    xpTotal: integer("xp_total").notNull().default(0),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("student_profiles_family_idx").on(t.familyId)],
);

export const parentStudentLinks = pgTable(
  "parent_student_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    parentUserId: uuid("parent_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    studentProfileId: uuid("student_profile_id")
      .notNull()
      .references(() => studentProfiles.id, { onDelete: "cascade" }),
    relation: text("relation"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("parent_student_links_uq").on(t.parentUserId, t.studentProfileId),
    index("parent_student_links_student_idx").on(t.studentProfileId),
  ],
);

export const familyInvitations = pgTable(
  "family_invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    relation: text("relation"),
    /** SHA-256 of the invitation token; the raw token is only emailed. */
    tokenHash: text("token_hash").notNull().unique(),
    invitedBy: uuid("invited_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: invitationStatusEnum("status").notNull().default("PENDING"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedBy: uuid("accepted_by").references(() => users.id, { onDelete: "set null" }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("family_invitations_family_idx").on(t.familyId)],
);
