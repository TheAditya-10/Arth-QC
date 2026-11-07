import "server-only";
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { AppError, conflict, notFound } from "@/lib/security/errors";
import { assertStudentAccess, type Actor } from "@/lib/security/actor";
import { computeMetrics, rewardMetric } from "./gamification";
import { audit } from "./audit.service";

export const rewardInputSchema = z.object({
  title: z.string().trim().min(3).max(60),
  description: z.string().trim().max(200).default(""),
  trigger: z.enum(["streak", "xp", "score", "improvement", "custom"]),
  threshold: z.coerce.number().int().min(0).max(100000),
  emoji: z.string().min(1).max(8),
  studentProfileId: z.string().uuid().optional(),
});

export type RewardUiStatus = "locked" | "unlocked" | "requested" | "approved" | "delivered";

/** Rewards for a student with server-computed eligibility and redemption state. */
export async function rewardsForStudent(studentProfileId: string, familyId: string, timezone: string) {
  const d = db();
  const [fam] = await d.select({ auto: schema.families.autoUnlockRewards }).from(schema.families).where(eq(schema.families.id, familyId));
  const defs = await d
    .select()
    .from(schema.rewardDefinitions)
    .where(
      and(
        eq(schema.rewardDefinitions.familyId, familyId),
        eq(schema.rewardDefinitions.isActive, true),
        or(isNull(schema.rewardDefinitions.studentProfileId), eq(schema.rewardDefinitions.studentProfileId, studentProfileId)),
      ),
    )
    .orderBy(desc(schema.rewardDefinitions.createdAt));
  const reds = defs.length
    ? await d
        .select()
        .from(schema.rewardRedemptions)
        .where(and(eq(schema.rewardRedemptions.studentProfileId, studentProfileId), inArray(schema.rewardRedemptions.rewardDefinitionId, defs.map((x) => x.id))))
        .orderBy(desc(schema.rewardRedemptions.requestedAt))
    : [];
  const m = await computeMetrics(d, studentProfileId, timezone);
  return defs.map((r) => {
    const latest = reds.find((x) => x.rewardDefinitionId === r.id);
    const metric = rewardMetric(r.triggerType, m);
    const eligible = metric !== null && metric >= r.threshold;
    let status: RewardUiStatus = "locked";
    if (latest?.status === "DELIVERED") status = "delivered";
    else if (latest?.status === "APPROVED") status = "approved";
    else if (latest?.status === "REQUESTED") status = "requested";
    else if (eligible && fam?.auto !== false) status = "unlocked";
    return {
      definition: r,
      redemption: latest ?? null,
      status,
      eligible,
      progress: r.triggerType === "CUSTOM" || r.threshold <= 0 ? (status === "locked" ? 0 : 100) : Math.min(100, Math.round(((metric ?? 0) / r.threshold) * 100)),
      metric: metric ?? 0,
    };
  });
}

const TRIGGER: Record<z.infer<typeof rewardInputSchema>["trigger"], "XP" | "STREAK" | "SCORE" | "IMPROVEMENT" | "CUSTOM"> = {
  streak: "STREAK",
  xp: "XP",
  score: "SCORE",
  improvement: "IMPROVEMENT",
  custom: "CUSTOM",
};

export async function createReward(actor: Actor, input: z.infer<typeof rewardInputSchema>) {
  if (input.trigger === "score" && input.threshold > 100) throw new AppError("VALIDATION", "Score must be 100% or less.");
  if (input.studentProfileId) await assertStudentAccess(actor, input.studentProfileId);
  const [r] = await db()
    .insert(schema.rewardDefinitions)
    .values({
      familyId: actor.familyId,
      studentProfileId: input.studentProfileId ?? null,
      title: input.title,
      description: input.description,
      emoji: input.emoji,
      triggerType: TRIGGER[input.trigger],
      threshold: input.trigger === "custom" ? 0 : input.threshold,
      createdBy: actor.userId,
    })
    .returning();
  return r;
}

async function ownedReward(actor: Actor, id: string) {
  const [r] = await db().select().from(schema.rewardDefinitions).where(and(eq(schema.rewardDefinitions.id, id), eq(schema.rewardDefinitions.isActive, true)));
  if (!r || r.familyId !== actor.familyId) throw notFound("Reward");
  return r;
}

export async function updateReward(actor: Actor, id: string, input: z.infer<typeof rewardInputSchema>) {
  await ownedReward(actor, id);
  await db()
    .update(schema.rewardDefinitions)
    .set({ title: input.title, description: input.description, emoji: input.emoji, triggerType: TRIGGER[input.trigger], threshold: input.trigger === "custom" ? 0 : input.threshold, updatedAt: new Date() })
    .where(eq(schema.rewardDefinitions.id, id));
}

export async function deleteReward(actor: Actor, id: string) {
  await ownedReward(actor, id);
  await db().update(schema.rewardDefinitions).set({ isActive: false, updatedAt: new Date() }).where(eq(schema.rewardDefinitions.id, id));
}

/** Student asks for an unlocked reward. Eligibility is re-checked server-side. */
export async function requestRedemption(actor: Actor & { studentProfileId: string }, rewardId: string) {
  const list = await rewardsForStudent(actor.studentProfileId, actor.familyId, actor.timezone);
  const item = list.find((x) => x.definition.id === rewardId);
  if (!item) throw notFound("Reward");
  if (item.status !== "unlocked") throw conflict(item.status === "locked" ? "This reward isn't unlocked yet." : "You've already asked for this reward.");
  try {
    const [r] = await db()
      .insert(schema.rewardRedemptions)
      .values({ rewardDefinitionId: rewardId, studentProfileId: actor.studentProfileId, status: "REQUESTED", eligibilitySnapshot: { metric: item.metric } })
      .returning();
    return r;
  } catch {
    throw conflict("You've already asked for this reward.");
  }
}

export const decisionSchema = z.object({
  studentProfileId: z.string().uuid(),
  action: z.enum(["approve", "decline", "deliver", "grant", "reset"]),
  note: z.string().trim().max(200).optional(),
});

/** Parent decisions. Physical rewards are only ever marked delivered by an explicit parent action. */
export async function decideRedemption(actor: Actor, rewardId: string, input: z.infer<typeof decisionSchema>) {
  const reward = await ownedReward(actor, rewardId);
  await assertStudentAccess(actor, input.studentProfileId);
  const d = db();
  const [open] = await d
    .select()
    .from(schema.rewardRedemptions)
    .where(and(eq(schema.rewardRedemptions.rewardDefinitionId, rewardId), eq(schema.rewardRedemptions.studentProfileId, input.studentProfileId), inArray(schema.rewardRedemptions.status, ["REQUESTED", "APPROVED"])))
    .limit(1);
  const now = new Date();
  await d.transaction(async (tx) => {
    switch (input.action) {
      case "approve":
        if (!open || open.status !== "REQUESTED") throw conflict("There is no pending request to approve.");
        await tx.update(schema.rewardRedemptions).set({ status: "APPROVED", decidedBy: actor.userId, decidedAt: now, note: input.note }).where(eq(schema.rewardRedemptions.id, open.id));
        break;
      case "decline":
        if (!open) throw conflict("There is nothing to decline.");
        await tx.update(schema.rewardRedemptions).set({ status: "DECLINED", decidedBy: actor.userId, decidedAt: now, note: input.note }).where(eq(schema.rewardRedemptions.id, open.id));
        break;
      case "grant":
        // Parent unlocks a reward directly (e.g. custom rewards).
        if (open) throw conflict("This reward already has an open request.");
        await tx.insert(schema.rewardRedemptions).values({ rewardDefinitionId: rewardId, studentProfileId: input.studentProfileId, status: "APPROVED", decidedBy: actor.userId, decidedAt: now, note: input.note });
        break;
      case "deliver":
        if (open) {
          await tx.update(schema.rewardRedemptions).set({ status: "DELIVERED", decidedBy: open.decidedBy ?? actor.userId, decidedAt: open.decidedAt ?? now, deliveredBy: actor.userId, deliveredAt: now }).where(eq(schema.rewardRedemptions.id, open.id));
        } else {
          await tx.insert(schema.rewardRedemptions).values({ rewardDefinitionId: rewardId, studentProfileId: input.studentProfileId, status: "DELIVERED", decidedBy: actor.userId, decidedAt: now, deliveredBy: actor.userId, deliveredAt: now });
        }
        break;
      case "reset":
        if (open) await tx.update(schema.rewardRedemptions).set({ status: "DECLINED", decidedBy: actor.userId, decidedAt: now, note: "Reset by parent" }).where(eq(schema.rewardRedemptions.id, open.id));
        break;
    }
    await audit(tx, { familyId: actor.familyId, actorUserId: actor.userId, action: `reward.${input.action}`, entityType: "reward", entityId: reward.id });
  });
}
