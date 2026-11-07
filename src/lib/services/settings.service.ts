import "server-only";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { assertStudentAccess, type Actor } from "@/lib/security/actor";
import { notFound } from "@/lib/security/errors";
import { isValidTimezone } from "@/lib/utils/timezone";
import { audit } from "./audit.service";

export const studentSettingsSchema = z.object({
  studentProfileId: z.string().uuid(),
  name: z.string().trim().min(2).max(40),
  grade: z.coerce.number().int().min(1).max(12),
  curriculum: z.enum(["NCERT", "CBSE", "ICSE", "State Board"]),
  school: z.string().trim().max(80).default(""),
  dailyGoalMinutes: z.coerce.number().int().min(10).max(180),
});

export async function updateStudentProfile(actor: Actor, input: z.infer<typeof studentSettingsSchema>) {
  await assertStudentAccess(actor, input.studentProfileId);
  const d = db();
  const [cur] = await d.select({ id: schema.curricula.id }).from(schema.curricula).where(eq(schema.curricula.code, input.curriculum));
  await d.transaction(async (tx) => {
    const [p] = await tx
      .update(schema.studentProfiles)
      .set({ displayName: input.name, grade: input.grade, school: input.school, dailyGoalMinutes: input.dailyGoalMinutes, curriculumId: cur?.id ?? null, updatedAt: new Date() })
      .where(eq(schema.studentProfiles.id, input.studentProfileId))
      .returning();
    if (!p) throw notFound("Student");
    await tx.update(schema.users).set({ name: input.name, updatedAt: new Date() }).where(eq(schema.users.id, p.userId));
    await audit(tx, { familyId: actor.familyId, actorUserId: actor.userId, action: "student.updated", entityType: "student_profile", entityId: p.id });
  });
}

export const parentSettingsSchema = z.object({
  userId: z.string().uuid(),
  name: z.string().trim().min(2).max(80),
  relation: z.enum(["Mother", "Father", "Guardian"]),
});

/** Parents can edit their own profile; email changes are not supported in-app. */
export async function updateParentProfile(actor: Actor, input: z.infer<typeof parentSettingsSchema>) {
  const d = db();
  const [m] = await d
    .select()
    .from(schema.familyMembers)
    .where(and(eq(schema.familyMembers.familyId, actor.familyId), eq(schema.familyMembers.userId, input.userId), eq(schema.familyMembers.role, "PARENT")));
  if (!m) throw notFound("Parent");
  await d.transaction(async (tx) => {
    if (input.userId === actor.userId) await tx.update(schema.users).set({ name: input.name, updatedAt: new Date() }).where(eq(schema.users.id, input.userId));
    await tx.update(schema.familyMembers).set({ relation: input.relation }).where(eq(schema.familyMembers.id, m.id));
    await tx.update(schema.reportRecipients).set({ name: input.userId === actor.userId ? input.name : undefined }).where(and(eq(schema.reportRecipients.familyId, actor.familyId), eq(schema.reportRecipients.userId, input.userId)));
  });
}

export const notificationSchema = z.object({
  submissionEvaluated: z.boolean().optional(),
  deadlineReminders: z.boolean().optional(),
  streakAlerts: z.boolean().optional(),
  achievementUnlocked: z.boolean().optional(),
  weakTopicAlerts: z.boolean().optional(),
});

export async function updateNotifications(actor: Actor, input: z.infer<typeof notificationSchema>) {
  await db()
    .insert(schema.notificationPreferences)
    .values({ userId: actor.userId, ...input })
    .onConflictDoUpdate({ target: schema.notificationPreferences.userId, set: { ...input, updatedAt: new Date() } });
}

export const appPrefsSchema = z.object({
  studentProfileId: z.string().uuid().optional(),
  soundEffects: z.boolean().optional(),
  showLeaderboardHints: z.boolean().optional(),
  celebrations: z.boolean().optional(),
  aiHintLevel: z.enum(["gentle", "standard", "detailed"]).optional(),
  autoUnlockRewards: z.boolean().optional(),
  timezone: z.string().refine(isValidTimezone, "Unknown timezone").optional(),
});

/**
 * Student-experience preferences are set by parents and stored on the student's
 * row (the student app reads them); family-wide settings go on the family.
 */
export async function updateAppPrefs(actor: Actor, input: z.infer<typeof appPrefsSchema>) {
  const d = db();
  if (input.autoUnlockRewards !== undefined || input.timezone) {
    await d
      .update(schema.families)
      .set({ ...(input.autoUnlockRewards !== undefined && { autoUnlockRewards: input.autoUnlockRewards }), ...(input.timezone && { timezone: input.timezone }), updatedAt: new Date() })
      .where(eq(schema.families.id, actor.familyId));
  }
  const targets = [actor.userId];
  if (input.studentProfileId) {
    await assertStudentAccess(actor, input.studentProfileId);
    const [p] = await d.select({ userId: schema.studentProfiles.userId }).from(schema.studentProfiles).where(eq(schema.studentProfiles.id, input.studentProfileId));
    if (p) targets.push(p.userId);
  }
  for (const userId of targets) {
    const [row] = await d.select().from(schema.notificationPreferences).where(eq(schema.notificationPreferences.userId, userId));
    const cur = row?.appPreferences ?? { soundEffects: true, showMotivation: true, celebrations: true, aiHintLevel: "gentle" as const };
    const next = {
      soundEffects: input.soundEffects ?? cur.soundEffects,
      showMotivation: input.showLeaderboardHints ?? cur.showMotivation,
      celebrations: input.celebrations ?? cur.celebrations,
      aiHintLevel: input.aiHintLevel ?? cur.aiHintLevel,
    };
    await d
      .insert(schema.notificationPreferences)
      .values({ userId, appPreferences: next })
      .onConflictDoUpdate({ target: schema.notificationPreferences.userId, set: { appPreferences: next, updatedAt: new Date() } });
  }
}

export async function markCelebrated(actor: Actor & { studentProfileId: string }, codes: string[]) {
  const d = db();
  for (const code of codes) {
    const [a] = await d.select({ id: schema.achievements.id }).from(schema.achievements).where(eq(schema.achievements.code, code));
    if (!a) continue;
    await d
      .update(schema.studentAchievements)
      .set({ celebratedAt: new Date() })
      .where(and(eq(schema.studentAchievements.studentProfileId, actor.studentProfileId), eq(schema.studentAchievements.achievementId, a.id)));
  }
}
