import "server-only";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db, schema, type DbOrTx } from "@/lib/db";
import { AppError, forbidden, notFound, unauthorized } from "./errors";

export interface Actor {
  userId: string;
  role: "PARENT" | "STUDENT" | "SUPER_ADMIN";
  name: string;
  email: string;
  familyId: string;
  timezone: string;
  /** Set for students: their own profile. */
  studentProfileId: string | null;
}

/**
 * Resolves the signed-in user from the session cookie and the database.
 * Role and family come from the database — never from the request.
 */
export async function getActor(): Promise<Actor | null> {
  const session = await auth().api.getSession({ headers: await headers() });
  if (!session) return null;
  const d = db();
  const [row] = await d
    .select({
      userId: schema.users.id,
      role: schema.users.role,
      name: schema.users.name,
      email: schema.users.email,
      familyId: schema.familyMembers.familyId,
      timezone: schema.families.timezone,
    })
    .from(schema.users)
    .innerJoin(schema.familyMembers, and(eq(schema.familyMembers.userId, schema.users.id), eq(schema.familyMembers.status, "ACTIVE")))
    .innerJoin(schema.families, eq(schema.families.id, schema.familyMembers.familyId))
    .where(eq(schema.users.id, session.user.id))
    .limit(1);
  if (!row) return null;
  let studentProfileId: string | null = null;
  if (row.role === "STUDENT") {
    const [p] = await d.select({ id: schema.studentProfiles.id }).from(schema.studentProfiles).where(eq(schema.studentProfiles.userId, row.userId)).limit(1);
    studentProfileId = p?.id ?? null;
    if (!studentProfileId) return null;
  }
  return { ...row, studentProfileId };
}

export async function requireActor(): Promise<Actor> {
  const a = await getActor();
  if (!a) throw unauthorized();
  return a;
}

export async function requireParent(): Promise<Actor> {
  const a = await requireActor();
  if (a.role !== "PARENT" && a.role !== "SUPER_ADMIN") throw forbidden("Only parents can do this.");
  return a;
}

export async function requireStudent(): Promise<Actor & { studentProfileId: string }> {
  const a = await requireActor();
  if (a.role !== "STUDENT" || !a.studentProfileId) throw forbidden("Only students can do this.");
  return a as Actor & { studentProfileId: string };
}

/**
 * Asserts the actor may access a student's data:
 * students only themselves; parents only students linked to them in their family.
 */
export async function assertStudentAccess(actor: Actor, studentProfileId: string, tx: DbOrTx = db()) {
  if (actor.role === "STUDENT") {
    if (actor.studentProfileId !== studentProfileId) throw forbidden();
    return;
  }
  const [link] = await tx
    .select({ id: schema.parentStudentLinks.id })
    .from(schema.parentStudentLinks)
    .innerJoin(schema.studentProfiles, eq(schema.studentProfiles.id, schema.parentStudentLinks.studentProfileId))
    .where(
      and(
        eq(schema.parentStudentLinks.parentUserId, actor.userId),
        eq(schema.parentStudentLinks.studentProfileId, studentProfileId),
        eq(schema.studentProfiles.familyId, actor.familyId),
      ),
    )
    .limit(1);
  if (!link) throw notFound("Student");
}

/** Students the parent may manage (linked + same family). */
export async function linkedStudents(actor: Actor, tx: DbOrTx = db()) {
  return tx
    .select({ id: schema.studentProfiles.id, displayName: schema.studentProfiles.displayName, grade: schema.studentProfiles.grade })
    .from(schema.parentStudentLinks)
    .innerJoin(schema.studentProfiles, eq(schema.studentProfiles.id, schema.parentStudentLinks.studentProfileId))
    .where(and(eq(schema.parentStudentLinks.parentUserId, actor.userId), eq(schema.studentProfiles.familyId, actor.familyId)))
    .orderBy(schema.studentProfiles.createdAt);
}

/** Resolve which student a request concerns. Students: self. Parents: given id or their first linked student. */
export async function resolveStudentId(actor: Actor, requested?: string | null): Promise<string> {
  if (actor.role === "STUDENT") return actor.studentProfileId!;
  if (requested) {
    await assertStudentAccess(actor, requested);
    return requested;
  }
  const [first] = await linkedStudents(actor);
  if (!first) throw new AppError("ONBOARDING_REQUIRED", "Add your child's student login to get started.");
  return first.id;
}
