import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, ne, sql } from "drizzle-orm";
import { auth, studentPlaceholderEmail } from "@/lib/auth";
import { db, schema, type Tx } from "@/lib/db";
import { appUrl } from "@/lib/env";
import { AppError, conflict, forbidden, notFound } from "@/lib/security/errors";
import type { Actor } from "@/lib/security/actor";
import { assertStudentAccess } from "@/lib/security/actor";
import { sendEmail } from "@/lib/email/resend.client";
import { invitationEmail } from "@/lib/email/templates/invitation";
import type { RegisterInput } from "@/lib/validation/account";
import { audit } from "./audit.service";

const INVITE_TTL_DAYS = 7;

async function hashPassword(password: string) {
  const ctx = await auth().$context;
  return ctx.password.hash(password);
}

async function insertCredentialUser(
  tx: Tx,
  u: { name: string; email: string; password: string; role: "PARENT" | "STUDENT"; username?: string },
) {
  const [user] = await tx
    .insert(schema.users)
    .values({
      name: u.name,
      email: u.email,
      role: u.role,
      username: u.username ?? null,
      displayUsername: u.username ?? null,
      emailVerified: false,
    })
    .returning();
  await tx.insert(schema.accounts).values({
    userId: user.id,
    accountId: user.id,
    providerId: "credential",
    password: await hashPassword(u.password),
  });
  return user;
}

async function emailTaken(email: string) {
  const [u] = await db().select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email)).limit(1);
  return Boolean(u);
}

/** Creates a parent account plus a new family, atomically. */
export async function registerParent(input: RegisterInput) {
  if (await emailTaken(input.email)) throw conflict("An account with this email already exists. Try signing in.");
  return db().transaction(async (tx) => {
    const user = await insertCredentialUser(tx, { name: input.name, email: input.email, password: input.password, role: "PARENT" });
    const [family] = await tx.insert(schema.families).values({ name: input.familyName, timezone: input.timezone }).returning();
    await tx.insert(schema.familyMembers).values({ familyId: family.id, userId: user.id, role: "PARENT", relation: input.relation });
    await tx.insert(schema.reportRecipients).values({ familyId: family.id, userId: user.id, name: user.name, email: user.email });
    await tx.insert(schema.notificationPreferences).values({ userId: user.id });
    await audit(tx, { familyId: family.id, actorUserId: user.id, action: "family.created", entityType: "family", entityId: family.id });
    return { userId: user.id, familyId: family.id };
  });
}

/** Parents create student accounts. Students have a username + PIN and no email. */
export async function createStudent(
  actor: Actor,
  input: { displayName: string; username: string; pin: string; grade: number; school: string },
) {
  const d = db();
  const [existing] = await d.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.username, input.username)).limit(1);
  if (existing) throw conflict("That username is taken. Try another.");
  return d.transaction(async (tx) => {
    const user = await insertCredentialUser(tx, {
      name: input.displayName,
      email: studentPlaceholderEmail(input.username),
      password: input.pin,
      role: "STUDENT",
      username: input.username,
    });
    const [curriculum] = await tx.select({ id: schema.curricula.id }).from(schema.curricula).where(eq(schema.curricula.code, "NCERT")).limit(1);
    const [profile] = await tx
      .insert(schema.studentProfiles)
      .values({
        userId: user.id,
        familyId: actor.familyId,
        displayName: input.displayName,
        grade: input.grade,
        school: input.school,
        curriculumId: curriculum?.id ?? null,
        createdBy: actor.userId,
      })
      .returning();
    await tx.insert(schema.familyMembers).values({ familyId: actor.familyId, userId: user.id, role: "STUDENT" });
    await tx.insert(schema.studentStreaks).values({ studentProfileId: profile.id });
    await tx.insert(schema.notificationPreferences).values({ userId: user.id });
    // Link every active parent in the family to the new student.
    const parents = await tx
      .select({ userId: schema.familyMembers.userId, relation: schema.familyMembers.relation })
      .from(schema.familyMembers)
      .where(and(eq(schema.familyMembers.familyId, actor.familyId), eq(schema.familyMembers.role, "PARENT"), eq(schema.familyMembers.status, "ACTIVE")));
    if (parents.length) {
      await tx
        .insert(schema.parentStudentLinks)
        .values(parents.map((p) => ({ familyId: actor.familyId, parentUserId: p.userId, studentProfileId: profile.id, relation: p.relation })));
    }
    await audit(tx, { familyId: actor.familyId, actorUserId: actor.userId, action: "student.created", entityType: "student_profile", entityId: profile.id });
    return { studentProfileId: profile.id, userId: user.id };
  });
}

export async function resetStudentPin(actor: Actor, studentProfileId: string, pin: string) {
  await assertStudentAccess(actor, studentProfileId);
  const d = db();
  const [p] = await d.select({ userId: schema.studentProfiles.userId }).from(schema.studentProfiles).where(eq(schema.studentProfiles.id, studentProfileId));
  if (!p) throw notFound("Student");
  const hash = await hashPassword(pin);
  await d.transaction(async (tx) => {
    await tx
      .update(schema.accounts)
      .set({ password: hash, updatedAt: new Date() })
      .where(and(eq(schema.accounts.userId, p.userId), eq(schema.accounts.providerId, "credential")));
    await tx.update(schema.users).set({ failedLoginCount: 0, lockedUntil: null }).where(eq(schema.users.id, p.userId));
    // Sign the student out everywhere.
    await tx.delete(schema.sessions).where(eq(schema.sessions.userId, p.userId));
    await audit(tx, { familyId: actor.familyId, actorUserId: actor.userId, action: "student.pin_reset", entityType: "student_profile", entityId: studentProfileId });
  });
}

// ---------------- Invitations ----------------

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export async function inviteParent(actor: Actor, email: string, relation: string) {
  const d = db();
  const [member] = await d
    .select({ id: schema.familyMembers.id })
    .from(schema.familyMembers)
    .innerJoin(schema.users, eq(schema.users.id, schema.familyMembers.userId))
    .where(and(eq(schema.familyMembers.familyId, actor.familyId), eq(schema.users.email, email), eq(schema.familyMembers.status, "ACTIVE")))
    .limit(1);
  if (member) throw conflict("This person is already in your family.");

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86400_000);
  const [family] = await d.select({ name: schema.families.name }).from(schema.families).where(eq(schema.families.id, actor.familyId));
  await d.transaction(async (tx) => {
    // Revoke older pending invites for the same address, then create a fresh one.
    await tx
      .update(schema.familyInvitations)
      .set({ status: "REVOKED" })
      .where(and(eq(schema.familyInvitations.familyId, actor.familyId), sql`lower(${schema.familyInvitations.email}) = ${email}`, eq(schema.familyInvitations.status, "PENDING")));
    await tx.insert(schema.familyInvitations).values({ familyId: actor.familyId, email, relation, tokenHash: sha256(token), invitedBy: actor.userId, expiresAt });
    await audit(tx, { familyId: actor.familyId, actorUserId: actor.userId, action: "invitation.created", entityType: "invitation", entityId: email });
  });
  const link = `${appUrl()}/invite/${token}`;
  const mail = invitationEmail({ inviterName: actor.name, familyName: family?.name ?? "your family", link, expiresInDays: INVITE_TTL_DAYS });
  const res = await sendEmail({ to: email, subject: mail.subject, html: mail.html, text: mail.text });
  await d.insert(schema.emailDeliveryLogs).values({
    familyId: actor.familyId,
    template: "invitation",
    recipientEmail: email,
    subject: mail.subject,
    status: res.status,
    providerMessageId: res.status === "SENT" ? res.providerMessageId : null,
    error: res.status === "FAILED" ? res.error : res.status === "SKIPPED" ? res.reason : null,
    attempts: 1,
    sentAt: res.status === "SENT" ? new Date() : null,
  });
  // When email isn't configured (local dev), return the link so it can be shared manually.
  return { emailStatus: res.status, devLink: res.status === "SKIPPED" ? link : undefined };
}

async function findValidInvitation(token: string) {
  const [inv] = await db()
    .select({
      id: schema.familyInvitations.id,
      familyId: schema.familyInvitations.familyId,
      email: schema.familyInvitations.email,
      relation: schema.familyInvitations.relation,
      familyName: schema.families.name,
      inviterName: schema.users.name,
    })
    .from(schema.familyInvitations)
    .innerJoin(schema.families, eq(schema.families.id, schema.familyInvitations.familyId))
    .innerJoin(schema.users, eq(schema.users.id, schema.familyInvitations.invitedBy))
    .where(
      and(
        eq(schema.familyInvitations.tokenHash, sha256(token)),
        eq(schema.familyInvitations.status, "PENDING"),
        gt(schema.familyInvitations.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return inv ?? null;
}

export async function getInvitation(token: string) {
  const inv = await findValidInvitation(token);
  if (!inv) throw notFound("Invitation");
  const exists = await emailTaken(inv.email);
  return { familyName: inv.familyName, inviterName: inv.inviterName, email: inv.email, accountExists: exists };
}

/**
 * Accepts an invitation. The invitee proves control of the invited address by
 * holding the emailed token. New users register here; existing users must be
 * signed in as the invited email.
 */
export async function acceptInvitation(input: { token: string; name?: string; password?: string }, signedInUserId: string | null) {
  const inv = await findValidInvitation(input.token);
  if (!inv) throw notFound("Invitation");
  const d = db();
  return d.transaction(async (tx) => {
    let userId: string;
    const [existing] = await tx.select().from(schema.users).where(eq(schema.users.email, inv.email)).limit(1);
    if (existing) {
      if (signedInUserId !== existing.id) throw forbidden("Sign in with the invited email address to accept this invitation.");
      const [other] = await tx
        .select({ id: schema.familyMembers.id })
        .from(schema.familyMembers)
        .where(and(eq(schema.familyMembers.userId, existing.id), eq(schema.familyMembers.status, "ACTIVE"), ne(schema.familyMembers.familyId, inv.familyId)))
        .limit(1);
      if (other) throw conflict("This account already belongs to another family.");
      userId = existing.id;
    } else {
      if (!input.name || !input.password) throw new AppError("VALIDATION", "Name and password are required to create your account.");
      const user = await insertCredentialUser(tx, { name: input.name, email: inv.email, password: input.password, role: "PARENT" });
      await tx.insert(schema.notificationPreferences).values({ userId: user.id });
      userId = user.id;
    }
    // Email ownership is proven by the token.
    await tx.update(schema.users).set({ emailVerified: true }).where(eq(schema.users.id, userId));
    await tx
      .insert(schema.familyMembers)
      .values({ familyId: inv.familyId, userId, role: "PARENT", relation: inv.relation })
      .onConflictDoUpdate({ target: [schema.familyMembers.familyId, schema.familyMembers.userId], set: { status: "ACTIVE" } });
    const students = await tx.select({ id: schema.studentProfiles.id }).from(schema.studentProfiles).where(eq(schema.studentProfiles.familyId, inv.familyId));
    if (students.length) {
      await tx
        .insert(schema.parentStudentLinks)
        .values(students.map((s) => ({ familyId: inv.familyId, parentUserId: userId, studentProfileId: s.id, relation: inv.relation })))
        .onConflictDoNothing();
    }
    const [u] = await tx.select({ name: schema.users.name, email: schema.users.email }).from(schema.users).where(eq(schema.users.id, userId));
    await tx.insert(schema.reportRecipients).values({ familyId: inv.familyId, userId, name: u.name, email: u.email }).onConflictDoNothing();
    await tx.update(schema.familyInvitations).set({ status: "ACCEPTED", acceptedBy: userId, acceptedAt: new Date() }).where(eq(schema.familyInvitations.id, inv.id));
    await audit(tx, { familyId: inv.familyId, actorUserId: userId, action: "invitation.accepted", entityType: "invitation", entityId: inv.id });
    return { userId, email: inv.email, isNewUser: !existing };
  });
}

export async function listInvitations(actor: Actor) {
  return db()
    .select({ id: schema.familyInvitations.id, email: schema.familyInvitations.email, status: schema.familyInvitations.status, expiresAt: schema.familyInvitations.expiresAt })
    .from(schema.familyInvitations)
    .where(and(eq(schema.familyInvitations.familyId, actor.familyId), eq(schema.familyInvitations.status, "PENDING"), gt(schema.familyInvitations.expiresAt, new Date())));
}

export async function revokeInvitation(actor: Actor, id: string) {
  const r = await db()
    .update(schema.familyInvitations)
    .set({ status: "REVOKED" })
    .where(and(eq(schema.familyInvitations.id, id), eq(schema.familyInvitations.familyId, actor.familyId)))
    .returning({ id: schema.familyInvitations.id });
  if (!r.length) throw notFound("Invitation");
}
