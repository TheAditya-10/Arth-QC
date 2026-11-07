/**
 * Seed script.
 *   npm run db:seed        → reference data only (subjects, curriculum, topics, achievements). Safe to re-run.
 *   npm run db:seed:demo   → also creates a demo family (2 parents + 1 student) with realistic history.
 *
 * Runs with the `react-server` condition so server-only modules can be imported.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { ACHIEVEMENTS, CURRICULA, MATH_TOPICS_G6, SUBJECTS } from "@/lib/db/seed/reference";
import type { Actor } from "@/lib/security/actor";
import { acceptInvitation, createStudent, inviteParent, registerParent } from "@/lib/services/account.service";
import { createAssignment } from "@/lib/services/assignment.service";
import { awardXp, evaluateAchievements, nextStreak, scoreBonusRule, pct, DEFAULT_XP_RULES } from "@/lib/services/gamification";
import { recordTopicAttempt } from "@/lib/services/progress";
import { generateReport } from "@/lib/services/report.service";
import { seedAssignments } from "@/lib/mock-data/assignments";
import { seedEvaluations } from "@/lib/mock-data/evaluations";
import { seedRewards } from "@/lib/mock-data/profile";
import { notebookPage } from "@/lib/utils/notebook";
import { addDaysStr, localDateIn, weekStartOf } from "@/lib/utils/timezone";
import { storage } from "@/lib/storage";

const TZ = "Asia/Kolkata";

async function seedReference() {
  const d = db();
  for (const s of SUBJECTS) {
    await d.insert(schema.subjects).values(s).onConflictDoUpdate({ target: schema.subjects.code, set: { name: s.name, enabled: s.enabled, sortOrder: s.sortOrder } });
  }
  for (const c of CURRICULA) {
    await d.insert(schema.curricula).values(c).onConflictDoUpdate({ target: schema.curricula.code, set: { name: c.name, board: c.board } });
  }
  const [math] = await d.select().from(schema.subjects).where(eq(schema.subjects.code, "mathematics"));
  const [ncert] = await d.select().from(schema.curricula).where(eq(schema.curricula.code, "NCERT"));
  for (const t of MATH_TOPICS_G6) {
    await d
      .insert(schema.topics)
      .values({ subjectId: math.id, curriculumId: ncert.id, code: t.code, name: t.name, grade: 6, chapter: t.chapter })
      .onConflictDoUpdate({ target: [schema.topics.subjectId, schema.topics.code, schema.topics.grade], set: { name: t.name, chapter: t.chapter } });
  }
  for (const [i, a] of ACHIEVEMENTS.entries()) {
    await d
      .insert(schema.achievements)
      .values({ ...a, sortOrder: i })
      .onConflictDoUpdate({ target: schema.achievements.code, set: { ...a, sortOrder: i } });
  }
  console.log(`✓ reference data: ${SUBJECTS.length} subjects, ${MATH_TOPICS_G6.length} topics, ${ACHIEVEMENTS.length} achievements`);
}

/** Renders a notebook-style PNG via Chromium if Playwright is available; otherwise returns null. */
async function renderNotebookPng(svgDataUrl: string): Promise<Uint8Array | null> {
  try {
    // Optional dependency, resolved at runtime only (honours NODE_PATH).
    const { createRequire } = await import("node:module");
    const { chromium } = createRequire(`${process.cwd()}/`)("playwright") as { chromium: { launch(): Promise<{ newPage(o: object): Promise<{ setContent(h: string): Promise<void>; screenshot(o: object): Promise<Buffer> }>; close(): Promise<void> }> } };
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 600, height: 800 } });
    await page.setContent(`<html><body style="margin:0"><img src="${svgDataUrl}" width="600" height="800"></body></html>`);
    const png = await page.screenshot({ type: "png" });
    await browser.close();
    return new Uint8Array(png);
  } catch {
    return null;
  }
}

function daysAgo(n: number, hour = 17) {
  const d = new Date(Date.now() - n * 86400_000);
  d.setUTCHours(hour - 5, 30, 0, 0); // ~local IST hour
  return d;
}

async function seedDemo() {
  const d = db();
  const parentEmail = process.env.DEMO_PARENT_EMAIL ?? "priya.parent@example.com";
  const password = process.env.DEMO_PARENT_PASSWORD ?? "ArthQC-demo-2026";
  const studentPin = process.env.DEMO_STUDENT_PIN ?? "246810";
  const [exists] = await d.select().from(schema.users).where(eq(schema.users.email, parentEmail));
  if (exists) {
    console.log(`• demo family already exists (${parentEmail}) — skipping`);
    return;
  }
  delete process.env.RESEND_API_KEY; // never email during seeding

  const { userId, familyId } = await registerParent({ name: "Priya Sharma", email: parentEmail, password, familyName: "Sharma Family", relation: "Mother", timezone: TZ });
  const parent: Actor = { userId, role: "PARENT", name: "Priya Sharma", email: parentEmail, familyId, timezone: TZ, studentProfileId: null };
  const { studentProfileId } = await createStudent(parent, { displayName: "Ananya", username: "ananya", pin: studentPin, grade: 6, school: "Kendriya Vidyalaya, Sector 8" });

  const invite = await inviteParent(parent, "rahul.parent@example.com", "Father");
  const token = invite.devLink?.split("/invite/")[1];
  if (token) await acceptInvitation({ token, name: "Rahul Sharma", password }, null);
  // Make Priya the "Mother" relation on links created before Rahul joined.
  console.log("✓ family: Priya (parent), Rahul (parent), Ananya (student)");

  // ---- Assignments (from the Phase 1 sample data) ----
  const idMap = new Map<string, string>();
  for (const a of seedAssignments()) {
    const { id } = await createAssignment(parent, {
      studentProfileId,
      title: a.title,
      subjectId: "mathematics",
      topicId: a.topicId,
      grade: 6,
      description: a.description,
      instructions: a.instructions,
      questions: a.questions.map((q) => ({
        text: q.text,
        marks: q.marks,
        expectedAnswer: q.expectedAnswer,
        expectedSolution: "",
        rubric: q.markingSteps && Math.abs(q.markingSteps.reduce((s, x) => s + x.marks, 0) - q.marks) < 0.01 ? q.markingSteps.map((m) => ({ description: m.description, marks: m.marks })) : [],
      })),
      difficulty: a.difficulty,
      estimatedMinutes: a.estimatedMinutes,
      dueDate: a.dueDate,
      markingScheme: a.markingScheme ?? "",
      allowAlternativeMethods: true,
      source: a.source,
      attachmentUploadIds: [],
    });
    idMap.set(a.id, id);
    await d.update(schema.assignments).set({ createdAt: new Date(a.createdAt), startedAt: a.status === "in_progress" ? new Date() : null }).where(eq(schema.assignments.id, id));
  }
  console.log(`✓ ${idMap.size} assignments`);

  // ---- Historical submissions + evaluations ----
  const evals = seedEvaluations();
  const daysAgoBySub: Record<string, number> = { s1: 10, s2: 24, s3: 5, s4: 17, s5: 2 };
  const samplePages: Record<string, string[]> = {
    s1: [["Q1. Seven crore eight lakh forty-five", "  thousand two hundred thirteen", "Q2. 47,058 < 47,580 < 47,805 < 48,750", "Q3. 5,000 + 17,000 = 22,000"], ["Q4. 1245 × 375 = ₹4,65,875", "Q5. 3000 + 250 = 3250"]].map((l, i) => notebookPage(l, i === 0 ? { title: "Large Numbers - HW" } : {})),
    s2: [notebookPage(["Q1. Successor 1,00,001", "  Predecessor 99,000", "Q2. (4×25)×1768 = 1,76,800", "Q3. Yes, 0 × a = 0", "Q4. 85,400 + 1,608 = 87,008", "Q5. 1,200 + 208 = 1,398"], { title: "Whole Numbers" })],
    s3: [notebookPage(["Q1. HCF = 2×3 = 6", "Q2. LCM(12,16,24) = 48", "Q3. 23, 29, 31, 33, 37", "Q4. HCF(850, 680) = 170 litres", "Q5. 980 = 2×2×5×49"], { title: "HCF & LCM" })],
    s4: [notebookPage(["Q1. Line goes forever both ways", "Q2. AB, BC, CD, DA = 4", "Q3. No, only one point", "Q4. P,Q,R,S ; PQ,QR,RS,SP", "Q5. d = 9 cm, No, not a chord"], { title: "Geometry" })],
    s5: [notebookPage(["Q1. 3 to 9 = 6 hours = 1/2", "Q2. acute, right, obtuse, reflex", "Q3. 4 × 30 = 120°", "Q4. 70°, obtuse triangle"], { title: "Angles" })],
  };
  const pngCache = new Map<string, Uint8Array | null>();
  const allMistakeIds: string[] = [];
  for (const e of evals) {
    const assignmentId = idMap.get(e.assignmentId)!;
    const ago = daysAgoBySub[e.submissionId];
    const when = daysAgo(ago);
    const qs = await d.select().from(schema.assignmentQuestions).where(eq(schema.assignmentQuestions.assignmentId, assignmentId)).orderBy(schema.assignmentQuestions.position);
    const [a] = await d.select().from(schema.assignments).where(eq(schema.assignments.id, assignmentId));
    const [sub] = await d
      .insert(schema.submissions)
      .values({ assignmentId, studentProfileId, familyId, idempotencyKey: `seed-${e.submissionId}-${randomUUID()}`, status: "COMPLETED", submittedAt: when, notes: e.submissionId === "s1" ? "Q4 was a bit tricky!" : null })
      .returning();
    // Notebook pages (PNG via Chromium when available).
    for (const [i, svg] of (samplePages[e.submissionId] ?? []).entries()) {
      if (!pngCache.has(svg)) pngCache.set(svg, await renderNotebookPng(svg));
      const png = pngCache.get(svg);
      if (!png) continue;
      const key = `families/${familyId}/submission/seed/${randomUUID()}.png`;
      const put = await storage().presignPut(key, { contentType: "image/png", contentLength: png.byteLength, expiresIn: 60 });
      if (storage().name === "local") {
        const { writeLocal } = await import("@/lib/storage/local.driver");
        await writeLocal(key, png, "image/png");
      } else if (storage().name === "db") {
        const { writeDbObject } = await import("@/lib/storage/db.driver");
        await writeDbObject(key, png, "image/png");
      } else {
        const res = await fetch(put.url, { method: "PUT", headers: put.headers, body: Buffer.from(png) });
        if (!res.ok) throw new Error(`upload failed ${res.status}`);
      }
      const [u] = await d
        .insert(schema.uploads)
        .values({ familyId, ownerUserId: (await d.select().from(schema.studentProfiles).where(eq(schema.studentProfiles.id, studentProfileId)))[0].userId, purpose: "SUBMISSION", storageKey: key, fileName: `notebook-page-${i + 1}.png`, mimeType: "image/png", declaredSize: png.byteLength, sizeBytes: png.byteLength, status: "ATTACHED", verifiedAt: when })
        .returning();
      await d.insert(schema.submissionFiles).values({ submissionId: sub.id, uploadId: u.id, storageKey: key, fileName: u.fileName, mimeType: "image/png", sizeBytes: png.byteLength, pageOrder: i + 1 });
    }
    const [job] = await d.insert(schema.evaluationJobs).values({ submissionId: sub.id, jobKey: `${sub.id}:v1`, status: "COMPLETED", attempts: 1, startedAt: when, completedAt: when }).returning();
    const [ev] = await d
      .insert(schema.evaluations)
      .values({
        submissionId: sub.id,
        jobId: job.id,
        aiScore: e.score,
        score: e.score,
        maxScore: e.maxScore,
        summary: e.summary,
        strengths: e.strengths,
        needsAttention: e.needsAttention,
        suggestedPractice: e.suggestedPractice,
        confidence: 0.93,
        model: "seed-data",
        promptVersion: "seed",
        createdAt: new Date(when.getTime() + 3600_000),
      })
      .returning();
    for (const r of e.results) {
      const q = qs[r.number - 1];
      const [qe] = await d
        .insert(schema.questionEvaluations)
        .values({
          evaluationId: ev.id,
          questionId: q.id,
          position: r.number,
          extractedAnswer: r.studentAnswer,
          extractedSteps: [r.studentAnswer],
          expectedAnswer: r.expectedAnswer,
          maxMarks: r.maxMarks,
          aiMarks: r.marksAwarded,
          awardedMarks: r.marksAwarded,
          result: r.status === "correct" ? "CORRECT" : r.status === "partial" ? "PARTIAL" : "INCORRECT",
          conceptAccuracy: r.errors.some((x) => x.kind === "conceptual") ? "NEEDS_IMPROVEMENT" : "STRONG",
          calculationAccuracy: r.errors.some((x) => x.kind === "calculation") ? "NEEDS_IMPROVEMENT" : "STRONG",
          finalAnswerStatus: r.status === "correct" ? "CORRECT" : "INCORRECT",
          mistakeTypes: r.errors.map((x) => x.kind),
          mistakeDescription: r.errors[0]?.description ?? null,
          explanation: r.explanation,
          confidence: 0.93,
        })
        .returning();
      await d.insert(schema.evaluationSteps).values(r.steps.map((s, i) => ({ questionEvaluationId: qe.id, position: i, description: s.description, awardedMarks: s.awarded, maxMarks: s.max, status: s.ok ? ("CORRECT" as const) : s.awarded > 0 ? ("PARTIAL" as const) : ("INCORRECT" as const) })));
      if (r.status !== "correct") {
        const [m] = await d
          .insert(schema.mistakeNotebook)
          .values({ studentProfileId, topicId: a.topicId, questionEvaluationId: qe.id, questionText: r.question, studentAnswer: r.studentAnswer, expectedAnswer: r.expectedAnswer, mistakeType: r.errors[0]?.kind ?? null, explanation: r.explanation, createdAt: when })
          .returning();
        allMistakeIds.push(m.id);
      }
    }
    await d.transaction(async (tx) => {
      await tx.insert(schema.learningActivityLogs).values({ studentProfileId, familyId, activityType: "ASSIGNMENT_COMPLETED", sourceType: "assignment", sourceId: assignmentId, localDate: localDateIn(TZ, when), minutes: a.estimatedMinutes, createdAt: when });
      await awardXp(tx, { studentProfileId, ruleKey: "HOMEWORK_COMPLETED", amount: DEFAULT_XP_RULES.HOMEWORK_COMPLETED, sourceType: "assignment", sourceId: assignmentId, description: `${a.title} completed` });
      const bonus = scoreBonusRule(pct(e.score, e.maxScore));
      if (bonus) await awardXp(tx, { studentProfileId, ruleKey: bonus, amount: DEFAULT_XP_RULES[bonus], sourceType: "assignment", sourceId: assignmentId, description: `Scored ${Math.round(pct(e.score, e.maxScore))}% on ${a.title}` });
      await recordTopicAttempt(tx, {
        studentProfileId,
        topicId: a.topicId,
        scorePct: pct(e.score, e.maxScore),
        questions: e.results.length,
        correct: e.results.filter((r) => r.status === "correct").length,
        errorTypes: e.results.flatMap((r) => r.errors.map((x) => x.kind)),
      });
    });
    await d.update(schema.xpTransactions).set({ createdAt: when }).where(and(eq(schema.xpTransactions.studentProfileId, studentProfileId), eq(schema.xpTransactions.sourceId, assignmentId)));
  }
  console.log(`✓ ${evals.length} evaluated submissions`);

  // Mark seven older mistakes as corrected (with XP), like the Phase 1 demo.
  const toCorrect = allMistakeIds.slice(0, 7);
  if (toCorrect.length) {
    await d.update(schema.mistakeNotebook).set({ status: "CORRECTED", correctedAt: daysAgo(7) }).where(inArray(schema.mistakeNotebook.id, toCorrect));
    await d.transaction(async (tx) => {
      for (const id of toCorrect) await awardXp(tx, { studentProfileId, ruleKey: "MISTAKE_CORRECTED", amount: DEFAULT_XP_RULES.MISTAKE_CORRECTED, sourceType: "mistake", sourceId: id, description: "Corrected a previous mistake" });
    });
  }

  // ---- Study history (practice days) and streak ----
  const today = localDateIn(TZ);
  const offsets = [1, 2, 3, 4, 5, 7, 8, 9, 11, 12, 14, 15, 16, 17, 18, 19, 21, 22, 25, 27, 29, 30, 32, 33, 35, 36];
  const [math] = await d.select().from(schema.subjects).where(eq(schema.subjects.code, "mathematics"));
  for (const [i, o] of offsets.entries()) {
    const when = daysAgo(o, 18);
    const correct = 3 + (i % 3);
    const [ps] = await d
      .insert(schema.practiceSessions)
      .values({ studentProfileId, familyId, mode: i % 4 === 0 ? "DAILY" : "CUSTOM", title: i % 4 === 0 ? "Daily Challenge" : "Practice", subjectId: math.id, difficulty: "MEDIUM", status: "COMPLETED", questionCount: 5, correctCount: correct, xpAwarded: DEFAULT_XP_RULES.PRACTICE_COMPLETED, timeSpentSeconds: 900, startedAt: when, completedAt: when })
      .returning();
    await d.insert(schema.learningActivityLogs).values({ studentProfileId, familyId, activityType: "PRACTICE_COMPLETED", sourceType: "practice_session", sourceId: ps.id, localDate: addDaysStr(today, -o), minutes: 20 + ((i * 17) % 25), createdAt: when });
    await d.transaction((tx) => awardXp(tx, { studentProfileId, ruleKey: "PRACTICE_COMPLETED", amount: DEFAULT_XP_RULES.PRACTICE_COMPLETED, sourceType: "practice_session", sourceId: ps.id, description: "Practice" }));
  }
  const days = (await d.selectDistinct({ day: schema.learningActivityLogs.localDate }).from(schema.learningActivityLogs).where(eq(schema.learningActivityLogs.studentProfileId, studentProfileId))).map((x) => x.day).sort();
  let st = { currentStreak: 0, longestStreak: 0, lastActivityDate: null as string | null };
  for (const day of days) st = nextStreak(st, day);
  await d.update(schema.studentStreaks).set({ ...st, updatedAt: new Date() }).where(eq(schema.studentStreaks.studentProfileId, studentProfileId));
  await d.update(schema.xpTransactions).set({ createdAt: sql`created_at - interval '1 day'` }).where(eq(schema.xpTransactions.ruleKey, "PRACTICE_COMPLETED"));
  console.log(`✓ ${offsets.length} practice sessions; streak ${st.currentStreak} (longest ${st.longestStreak})`);

  // ---- Rewards ----
  const triggerMap = { streak: "STREAK", xp: "XP", score: "SCORE", improvement: "IMPROVEMENT", custom: "CUSTOM" } as const;
  for (const r of seedRewards()) {
    const [def] = await d
      .insert(schema.rewardDefinitions)
      .values({ familyId, title: r.title, description: r.description, emoji: r.emoji, triggerType: triggerMap[r.trigger], threshold: r.threshold, createdBy: userId })
      .returning();
    if (r.status === "delivered") {
      await d.insert(schema.rewardRedemptions).values({ rewardDefinitionId: def.id, studentProfileId, status: "DELIVERED", requestedAt: daysAgo(10), decidedBy: userId, decidedAt: daysAgo(9), deliveredBy: userId, deliveredAt: daysAgo(8) });
    }
  }

  // ---- Achievements (celebrated already, so the demo doesn't open with pop-ups) ----
  await d.transaction((tx) => evaluateAchievements(tx, studentProfileId, TZ));
  await d.update(schema.studentAchievements).set({ celebratedAt: new Date() }).where(eq(schema.studentAchievements.studentProfileId, studentProfileId));

  // ---- Past weekly reports ----
  for (const w of [1, 2, 3]) {
    const ws = addDaysStr(weekStartOf(today), -7 * w);
    const rep = await generateReport(studentProfileId, familyId, ws, TZ);
    await d.update(schema.weeklyReports).set({ status: "SENT", generatedAt: new Date(`${addDaysStr(ws, 6)}T13:30:00Z`), sentAt: new Date(`${addDaysStr(ws, 6)}T13:30:00Z`) }).where(eq(schema.weeklyReports.id, rep.id));
  }
  const [p] = await d.select({ xp: schema.studentProfiles.xpTotal }).from(schema.studentProfiles).where(eq(schema.studentProfiles.id, studentProfileId));
  console.log(`✓ rewards, achievements, 3 past weekly reports — student XP ${p.xp}`);
  console.log("\nDemo logins:");
  console.log(`  Parent:  ${parentEmail} / ${password}   (second parent: rahul.parent@example.com / ${password})`);
  console.log(`  Student: username "ananya" / PIN ${studentPin}`);
}

async function main() {
  await seedReference();
  if (process.argv.includes("--demo")) await seedDemo();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
