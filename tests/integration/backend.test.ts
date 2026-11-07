import { describe, expect, it, beforeAll } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Actor } from "@/lib/security/actor";
import { assertStudentAccess } from "@/lib/security/actor";
import { createStudent, registerParent } from "@/lib/services/account.service";
import { createAssignment } from "@/lib/services/assignment.service";
import { awardXp, recordActivity, familyContext } from "@/lib/services/gamification";
import { claimJobs, enqueueEvaluation, processPendingJobs } from "@/lib/services/evaluation.service";
import { writeLocal } from "@/lib/storage/local.driver";

const run = process.env.TEST_DATABASE_URL ? describe : describe.skip;

let parent: Actor;
let studentId: string;
let otherParent: Actor;

async function makeFamily(tag: string) {
  const email = `${tag}-${randomUUID().slice(0, 8)}@example.com`;
  const { userId, familyId } = await registerParent({ name: `Parent ${tag}`, email, password: "Password12345", familyName: `Fam ${tag}`, relation: "Mother", timezone: "Asia/Kolkata" });
  return { userId, role: "PARENT" as const, name: `Parent ${tag}`, email, familyId, timezone: "Asia/Kolkata", studentProfileId: null };
}

async function makeSubmission() {
  const { id: assignmentId } = await createAssignment(parent, {
    studentProfileId: studentId,
    title: "Integration test",
    subjectId: "mathematics",
    topicId: "fractions",
    grade: 6,
    description: "Integration test assignment.",
    instructions: [],
    questions: [
      { text: "Add 3/4 and 1/2", marks: 10, expectedAnswer: "5/4", expectedSolution: "", rubric: [] },
      { text: "Reduce 36/48", marks: 5, expectedAnswer: "3/4", expectedSolution: "", rubric: [] },
    ],
    difficulty: "medium",
    estimatedMinutes: 20,
    dueDate: new Date(Date.now() + 86400_000).toISOString(),
    markingScheme: "",
    allowAlternativeMethods: true,
    source: "manual",
    attachmentUploadIds: [],
  });
  const d = db();
  const [profile] = await d.select().from(schema.studentProfiles).where(eq(schema.studentProfiles.id, studentId));
  const key = `families/${parent.familyId}/submission/test/${randomUUID()}.png`;
  await writeLocal(key, new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/png");
  const [u] = await d.insert(schema.uploads).values({ familyId: parent.familyId, ownerUserId: profile.userId, purpose: "SUBMISSION", storageKey: key, fileName: "p.png", mimeType: "image/png", declaredSize: 8, sizeBytes: 8, status: "ATTACHED" }).returning();
  const [sub] = await d.insert(schema.submissions).values({ assignmentId, studentProfileId: studentId, familyId: parent.familyId, idempotencyKey: randomUUID() }).returning();
  await d.insert(schema.submissionFiles).values({ submissionId: sub.id, uploadId: u.id, storageKey: key, fileName: "p.png", mimeType: "image/png", sizeBytes: 8, pageOrder: 1 });
  return { assignmentId, submissionId: sub.id };
}

run("backend integration (Postgres)", () => {
  beforeAll(async () => {
    parent = await makeFamily("a");
    ({ studentProfileId: studentId } = await createStudent(parent, { displayName: "Test Kid", username: `kid_${randomUUID().slice(0, 6)}`, pin: "123456", grade: 6, school: "" }));
    otherParent = await makeFamily("b");
  });

  it("awards XP exactly once per rule + source, even when retried concurrently", async () => {
    const d = db();
    const sourceId = randomUUID();
    const results = await Promise.all(
      Array.from({ length: 5 }).map(() =>
        d.transaction((tx) => awardXp(tx, { studentProfileId: studentId, ruleKey: "HOMEWORK_COMPLETED", amount: 30, sourceType: "assignment", sourceId, description: "test" })),
      ),
    );
    expect(results.filter((x) => x === 30)).toHaveLength(1);
    const rows = await d.select().from(schema.xpTransactions).where(eq(schema.xpTransactions.sourceId, sourceId));
    expect(rows).toHaveLength(1);
  });

  it("records an activity once and advances the streak once per local day", async () => {
    const d = db();
    const fam = await familyContext(d, studentId);
    const src = randomUUID();
    const first = await d.transaction((tx) => recordActivity(tx, { studentProfileId: studentId, familyId: fam.familyId, timezone: fam.timezone, type: "PRACTICE_COMPLETED", sourceType: "practice_session", sourceId: src, minutes: 10, dailyGoalMinutes: 30 }));
    const again = await d.transaction((tx) => recordActivity(tx, { studentProfileId: studentId, familyId: fam.familyId, timezone: fam.timezone, type: "PRACTICE_COMPLETED", sourceType: "practice_session", sourceId: src, minutes: 10, dailyGoalMinutes: 30 }));
    await d.transaction((tx) => recordActivity(tx, { studentProfileId: studentId, familyId: fam.familyId, timezone: fam.timezone, type: "PRACTICE_COMPLETED", sourceType: "practice_session", sourceId: randomUUID(), minutes: 10, dailyGoalMinutes: 30 }));
    expect(first).toBe(true);
    expect(again).toBe(false);
    const [s] = await d.select().from(schema.studentStreaks).where(eq(schema.studentStreaks.studentProfileId, studentId));
    expect(s.currentStreak).toBe(1);
  });

  it("never creates duplicate evaluation jobs for the same submission version", async () => {
    const { submissionId } = await makeSubmission();
    const d = db();
    await Promise.all([1, 2, 3].map(() => d.transaction((tx) => enqueueEvaluation(tx, submissionId, 1))));
    const jobs = await d.select().from(schema.evaluationJobs).where(eq(schema.evaluationJobs.submissionId, submissionId));
    expect(jobs).toHaveLength(1);
  });

  it("lets only one worker claim a job (FOR UPDATE SKIP LOCKED)", async () => {
    const { submissionId } = await makeSubmission();
    const d = db();
    const job = await d.transaction((tx) => enqueueEvaluation(tx, submissionId, 1));
    const claims = await Promise.all([1, 2, 3, 4].map(() => claimJobs(5, job.id)));
    expect(claims.flatMap((c) => c.jobIds).filter((id) => id === job.id)).toHaveLength(1);
  });

  it("runs the full pipeline with the mock provider and persists a validated evaluation", async () => {
    const { submissionId, assignmentId } = await makeSubmission();
    const d = db();
    const job = await d.transaction((tx) => enqueueEvaluation(tx, submissionId, 1));
    const out = await processPendingJobs(1, job.id);
    expect(["COMPLETED", "NEEDS_REVIEW"]).toContain(out[0]?.status);
    const [ev] = await d.select().from(schema.evaluations).where(eq(schema.evaluations.submissionId, submissionId));
    expect(ev.maxScore).toBe(15);
    expect(ev.score).toBeLessThanOrEqual(15);
    const qes = await d.select().from(schema.questionEvaluations).where(eq(schema.questionEvaluations.evaluationId, ev.id));
    expect(qes).toHaveLength(2);
    // Re-running the same job does nothing (idempotent).
    await processPendingJobs(1, job.id);
    expect(await d.select().from(schema.evaluations).where(eq(schema.evaluations.submissionId, submissionId))).toHaveLength(1);
    const xp = await d.select().from(schema.xpTransactions).where(eq(schema.xpTransactions.sourceId, assignmentId));
    expect(xp.filter((x) => x.ruleKey === "HOMEWORK_COMPLETED")).toHaveLength(1);
  });

  it("blocks parents from other families and students from other students", async () => {
    await expect(assertStudentAccess(otherParent, studentId)).rejects.toThrow(/not found/i);
    await expect(assertStudentAccess(parent, studentId)).resolves.toBeUndefined();
    const fakeStudent = { ...parent, role: "STUDENT" as const, studentProfileId: randomUUID() };
    await expect(assertStudentAccess(fakeStudent, studentId)).rejects.toThrow();
  });
});
