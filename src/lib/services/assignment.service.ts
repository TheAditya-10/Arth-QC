import "server-only";
import { and, count, eq, inArray, isNull } from "drizzle-orm";
import { db, schema, type Tx } from "@/lib/db";
import { AppError, conflict, notFound } from "@/lib/security/errors";
import { assertStudentAccess, resolveStudentId, type Actor } from "@/lib/security/actor";
import type { ApiAssignmentInput } from "@/lib/validation/assignment";
import { generateQuestions } from "@/lib/ai/practice-generator";
import { resolveSubject, resolveTopic, toDbDifficulty } from "./catalog";
import { audit } from "./audit.service";
import { deleteObjects } from "@/lib/storage/upload.service";

async function attachUploads(tx: Tx, actor: Actor, assignmentId: string, uploadIds: string[]) {
  if (!uploadIds.length) return;
  const rows = await tx.select().from(schema.uploads).where(inArray(schema.uploads.id, uploadIds));
  for (const id of uploadIds) {
    const u = rows.find((r) => r.id === id);
    if (!u || u.familyId !== actor.familyId || u.purpose !== "ASSIGNMENT_ATTACHMENT" || !["UPLOADED", "ATTACHED"].includes(u.status)) {
      throw new AppError("VALIDATION", "One of the attached worksheets is invalid or not uploaded yet.");
    }
  }
  const existing = await tx.select({ uploadId: schema.assignmentAttachments.uploadId }).from(schema.assignmentAttachments).where(eq(schema.assignmentAttachments.assignmentId, assignmentId));
  const fresh = rows.filter((r) => !existing.some((e) => e.uploadId === r.id));
  if (fresh.length) {
    await tx.insert(schema.assignmentAttachments).values(
      fresh.map((u) => ({ assignmentId, uploadId: u.id, storageKey: u.storageKey, fileName: u.fileName, mimeType: u.mimeType, sizeBytes: u.sizeBytes ?? u.declaredSize, uploadedBy: actor.userId })),
    );
    await tx.update(schema.uploads).set({ status: "ATTACHED" }).where(inArray(schema.uploads.id, fresh.map((u) => u.id)));
  }
}

async function insertQuestions(tx: Tx, assignmentId: string, topicId: string, input: ApiAssignmentInput) {
  const qs = await tx
    .insert(schema.assignmentQuestions)
    .values(
      input.questions.map((q, i) => ({
        assignmentId,
        position: i + 1,
        questionText: q.text,
        expectedAnswer: q.expectedAnswer,
        expectedSolution: q.expectedSolution || null,
        maxMarks: q.marks,
        difficulty: toDbDifficulty(q.difficulty ?? input.difficulty),
        topicId,
      })),
    )
    .returning({ id: schema.assignmentQuestions.id, position: schema.assignmentQuestions.position });
  const rubricRows = qs
    .map((q) => ({ q, src: input.questions[q.position - 1] }))
    .filter(({ src }) => src.rubric.length > 0)
    .map(({ q, src }) => ({
      questionId: q.id,
      source: "PARENT" as const,
      version: 1,
      steps: src.rubric,
      expectedSolution: src.expectedSolution || null,
      totalMarks: src.marks,
    }));
  if (rubricRows.length) await tx.insert(schema.markingRubrics).values(rubricRows);
}

export async function createAssignment(actor: Actor, input: ApiAssignmentInput) {
  const studentProfileId = await resolveStudentId(actor, input.studentProfileId);
  const d = db();
  return d.transaction(async (tx) => {
    const subject = await resolveSubject(tx, input.subjectId);
    const topic = await resolveTopic(tx, subject.id, input.topicId, input.grade);
    const total = input.questions.reduce((s, q) => s + q.marks, 0);
    const [a] = await tx
      .insert(schema.assignments)
      .values({
        familyId: actor.familyId,
        studentProfileId,
        subjectId: subject.id,
        topicId: topic.id,
        grade: input.grade,
        title: input.title,
        description: input.description,
        instructions: input.instructions,
        difficulty: toDbDifficulty(input.difficulty),
        dueAt: new Date(input.dueDate),
        totalMarks: Math.round(total),
        estimatedMinutes: input.estimatedMinutes,
        source: input.source === "ai" ? "AI" : "PARENT",
        status: "PUBLISHED",
        markingConfig: { markingScheme: input.markingScheme || undefined, allowAlternativeMethods: input.allowAlternativeMethods, partialCredit: true },
        createdBy: actor.userId,
      })
      .returning();
    await insertQuestions(tx, a.id, topic.id, input);
    await attachUploads(tx, actor, a.id, input.attachmentUploadIds);
    await audit(tx, { familyId: actor.familyId, actorUserId: actor.userId, action: "assignment.created", entityType: "assignment", entityId: a.id });
    return { id: a.id };
  });
}

async function loadOwned(actor: Actor, id: string) {
  const [a] = await db().select().from(schema.assignments).where(and(eq(schema.assignments.id, id), isNull(schema.assignments.deletedAt)));
  if (!a || a.familyId !== actor.familyId) throw notFound("Assignment");
  await assertStudentAccess(actor, a.studentProfileId);
  return a;
}

export async function updateAssignment(actor: Actor, id: string, input: ApiAssignmentInput) {
  const a = await loadOwned(actor, id);
  const d = db();
  const [{ n }] = await d.select({ n: count() }).from(schema.submissions).where(and(eq(schema.submissions.assignmentId, id), isNull(schema.submissions.deletedAt)));
  return d.transaction(async (tx) => {
    const subject = await resolveSubject(tx, input.subjectId);
    const topic = await resolveTopic(tx, subject.id, input.topicId, input.grade);
    const existingQs = await tx.select().from(schema.assignmentQuestions).where(eq(schema.assignmentQuestions.assignmentId, id));
    const questionsChanged =
      existingQs.length !== input.questions.length ||
      input.questions.some((q, i) => {
        const e = existingQs.find((x) => x.position === i + 1);
        return !e || e.questionText !== q.text || e.expectedAnswer !== q.expectedAnswer || Math.abs(e.maxMarks - q.marks) > 0.001;
      });
    if (questionsChanged && n > 0) throw conflict("Questions can't be changed after the student has submitted. Create a new assignment instead.");
    await tx
      .update(schema.assignments)
      .set({
        title: input.title,
        description: input.description,
        instructions: input.instructions,
        difficulty: toDbDifficulty(input.difficulty),
        dueAt: new Date(input.dueDate),
        estimatedMinutes: input.estimatedMinutes,
        topicId: topic.id,
        subjectId: subject.id,
        grade: input.grade,
        markingConfig: { markingScheme: input.markingScheme || undefined, allowAlternativeMethods: input.allowAlternativeMethods, partialCredit: true },
        totalMarks: Math.round(input.questions.reduce((s, q) => s + q.marks, 0)),
        updatedAt: new Date(),
      })
      .where(eq(schema.assignments.id, id));
    if (questionsChanged) {
      await tx.delete(schema.assignmentQuestions).where(eq(schema.assignmentQuestions.assignmentId, id));
      await insertQuestions(tx, id, topic.id, input);
    } else {
      // Rubric / solution edits create a new parent rubric version.
      for (const [i, q] of input.questions.entries()) {
        const e = existingQs.find((x) => x.position === i + 1)!;
        await tx.update(schema.assignmentQuestions).set({ expectedSolution: q.expectedSolution || null }).where(eq(schema.assignmentQuestions.id, e.id));
        if (q.rubric.length) {
          const versions = await tx.select({ v: schema.markingRubrics.version, steps: schema.markingRubrics.steps, source: schema.markingRubrics.source }).from(schema.markingRubrics).where(eq(schema.markingRubrics.questionId, e.id));
          const latestParent = versions.filter((v) => v.source === "PARENT").sort((x, y) => y.v - x.v)[0];
          if (!latestParent || JSON.stringify(latestParent.steps) !== JSON.stringify(q.rubric)) {
            await tx.update(schema.markingRubrics).set({ isActive: false }).where(eq(schema.markingRubrics.questionId, e.id));
            await tx.insert(schema.markingRubrics).values({ questionId: e.id, source: "PARENT", version: Math.max(0, ...versions.map((v) => v.v)) + 1, steps: q.rubric, totalMarks: q.marks, expectedSolution: q.expectedSolution || null });
          }
        }
      }
    }
    await attachUploads(tx, actor, id, input.attachmentUploadIds);
    await audit(tx, { familyId: actor.familyId, actorUserId: actor.userId, action: "assignment.updated", entityType: "assignment", entityId: a.id });
    return { id };
  });
}

/** Soft delete keeps evaluation history; attachments are removed from storage. */
export async function deleteAssignment(actor: Actor, id: string) {
  await loadOwned(actor, id);
  const d = db();
  const attachments = await d.select({ key: schema.assignmentAttachments.storageKey }).from(schema.assignmentAttachments).where(eq(schema.assignmentAttachments.assignmentId, id));
  await d.transaction(async (tx) => {
    await tx.update(schema.assignments).set({ deletedAt: new Date(), status: "ARCHIVED" }).where(eq(schema.assignments.id, id));
    await audit(tx, { familyId: actor.familyId, actorUserId: actor.userId, action: "assignment.deleted", entityType: "assignment", entityId: id });
  });
  await deleteObjects(attachments.map((a) => a.key));
}

export async function markStarted(actor: Actor & { studentProfileId: string }, id: string) {
  await db()
    .update(schema.assignments)
    .set({ startedAt: new Date() })
    .where(and(eq(schema.assignments.id, id), eq(schema.assignments.studentProfileId, actor.studentProfileId), isNull(schema.assignments.startedAt)));
}

/** AI homework generation — returns a draft for the parent to review and edit before saving. */
export async function generateAssignmentDraft(actor: Actor, input: { topicId: string; grade: number; difficulty: "easy" | "medium" | "hard"; count: number; marksEach: number; questionTypes?: string[] }) {
  const d = db();
  const subject = await resolveSubject(d, "mathematics");
  const topic = await resolveTopic(d, subject.id, input.topicId, input.grade);
  const { data } = await generateQuestions({
    grade: input.grade,
    topicCode: topic.code,
    topicName: topic.name,
    difficulty: toDbDifficulty(input.difficulty),
    count: input.count,
    marksEach: input.marksEach,
    questionTypes: input.questionTypes,
    referenceId: `draft:${actor.userId}`,
  });
  return {
    title: data.title,
    description: data.description || `Practice on ${topic.name}.`,
    questions: data.questions.map((q) => ({ text: q.question_text, marks: q.marks, expectedAnswer: q.expected_answer, expectedSolution: q.expected_solution, rubric: q.rubric })),
  };
}
