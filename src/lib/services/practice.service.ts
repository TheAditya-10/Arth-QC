import "server-only";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { AppError, conflict, notFound } from "@/lib/security/errors";
import type { Actor } from "@/lib/security/actor";
import { rateLimit } from "@/lib/security/rate-limit";
import { equivalentAnswers } from "@/lib/math/exact";
import { PRACTICE_BANK } from "@/lib/mock-data/practice-bank";
import { generateQuestions } from "@/lib/ai/practice-generator";
import { aiProvider, models } from "@/lib/ai";
import { answerJudgeSchema } from "@/lib/ai/schemas";
import { JUDGE_SYSTEM, PROMPT_VERSIONS } from "@/lib/ai/prompts";
import { localDateIn, weekStartOf } from "@/lib/utils/timezone";
import { afterProgress, awardXp, familyContext, practiceXpAllowed, recordActivity } from "./gamification";
import { recordTopicAttempt, recommendationsFor } from "./progress";
import { resolveSubject } from "./catalog";

type Mode = "CUSTOM" | "DAILY" | "WEAK_TOPIC" | "REVISION" | "WEEKLY" | "MISTAKE_RETRY";
type Diff = "EASY" | "MEDIUM" | "HARD";

export const startPracticeSchema = z.object({
  mode: z.enum(["custom", "daily", "weak", "revision", "weekly", "retry"]),
  topicId: z.string().trim().max(64).default("mixed"),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  count: z.coerce.number().int().min(1).max(10).default(5),
  evaluationId: z.string().uuid().optional(),
});

export const answerSchema = z.object({
  answer: z.string().trim().min(1).max(300),
  steps: z.array(z.string().trim().max(300)).max(10).default([]),
  timeSpentSeconds: z.coerce.number().int().min(0).max(3600).default(0),
});

const MODE_MAP: Record<z.infer<typeof startPracticeSchema>["mode"], Mode> = {
  custom: "CUSTOM",
  daily: "DAILY",
  weak: "WEAK_TOPIC",
  revision: "REVISION",
  weekly: "WEEKLY",
  retry: "MISTAKE_RETRY",
};

export const MODE_TITLES: Record<Mode, string> = {
  CUSTOM: "Practice",
  DAILY: "Daily Challenge",
  WEAK_TOPIC: "Weak-Topic Booster",
  REVISION: "Quick Revision",
  WEEKLY: "Weekly Challenge",
  MISTAKE_RETRY: "Retry mistakes",
};

interface Draft {
  topicCode: string;
  difficulty: Diff;
  text: string;
  answer: string;
  accepted: string[];
  solution: string;
  hint: string;
  mistakeId?: string;
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function fromBank(topicCodes: string[], difficulties: Diff[], count: number, seed: number): Draft[] {
  const want = difficulties.map((d) => d.toLowerCase());
  const primary = seededShuffle(PRACTICE_BANK.filter((q) => topicCodes.includes(q.topicId) && want.includes(q.difficulty)), seed);
  const extra = seededShuffle(PRACTICE_BANK.filter((q) => topicCodes.includes(q.topicId) && !want.includes(q.difficulty)), seed + 1);
  return [...primary, ...extra].slice(0, count).map((q) => ({
    topicCode: q.topicId,
    difficulty: q.difficulty.toUpperCase() as Diff,
    text: q.text,
    answer: q.answer,
    accepted: q.accepts ?? [],
    solution: q.explanation,
    hint: q.hint,
  }));
}

function aiEnabled() {
  try {
    aiProvider();
    return true;
  } catch {
    return false;
  }
}

/** Builds a practice session. Answers are stored server-side and never sent to the browser. */
export async function startSession(actor: Actor & { studentProfileId: string }, input: z.infer<typeof startPracticeSchema>) {
  const d = db();
  const mode = MODE_MAP[input.mode];
  const [profile] = await d.select().from(schema.studentProfiles).where(eq(schema.studentProfiles.id, actor.studentProfileId));
  const subject = await resolveSubject(d, "mathematics");
  const topics = await d.select().from(schema.topics).where(and(eq(schema.topics.subjectId, subject.id), eq(schema.topics.grade, profile.grade)));
  const allCodes = topics.map((t) => t.code);
  const today = localDateIn(actor.timezone);
  const daySeed = Number(today.replace(/-/g, ""));
  let drafts: Draft[] = [];
  let generatedBy = "bank";
  let difficulty: Diff = input.difficulty.toUpperCase() as Diff;
  let topicCode: string | null = input.topicId !== "mixed" ? input.topicId : null;
  let sourceEvaluationId: string | null = null;

  switch (mode) {
    case "DAILY":
      drafts = fromBank(allCodes, ["EASY", "MEDIUM"], 5, daySeed);
      difficulty = "MEDIUM";
      topicCode = null;
      break;
    case "WEEKLY":
      drafts = fromBank(allCodes, ["HARD"], 10, Number(weekStartOf(today).replace(/-/g, "")));
      difficulty = "HARD";
      topicCode = null;
      break;
    case "REVISION": {
      const covered = await d
        .select({ code: schema.topics.code })
        .from(schema.topicProgress)
        .innerJoin(schema.topics, eq(schema.topics.id, schema.topicProgress.topicId))
        .where(eq(schema.topicProgress.studentProfileId, actor.studentProfileId));
      drafts = fromBank(covered.length ? covered.map((c) => c.code) : allCodes, ["EASY"], 5, Date.now() % 100000);
      difficulty = "EASY";
      topicCode = null;
      break;
    }
    case "WEAK_TOPIC": {
      const recs = await recommendationsFor(d, actor.studentProfileId, profile.grade);
      const focus = recs.slice(0, 2);
      const codes = focus.length ? focus.map((r) => topics.find((t) => t.id === r.topicId)!.code) : allCodes.slice(0, 2);
      difficulty = focus[0]?.difficulty ?? "EASY";
      topicCode = codes[0];
      if (aiEnabled()) {
        try {
          const t = topics.find((x) => x.code === codes[0])!;
          const { data } = await generateQuestions({
            grade: profile.grade,
            topicCode: t.code,
            topicName: t.name,
            difficulty,
            count: 6,
            marksEach: 1,
            focus: focus.map((f) => `${f.topicName}: ${f.reason}`),
            referenceId: `practice:${actor.studentProfileId}`,
          });
          drafts = data.questions.map((q) => ({ topicCode: t.code, difficulty: q.difficulty, text: q.question_text, answer: q.expected_answer, accepted: q.accepted_answers, solution: q.expected_solution, hint: q.hint }));
          generatedBy = "ai";
        } catch (e) {
          console.warn("[practice] AI generation failed, using question bank", e);
        }
      }
      if (!drafts.length) drafts = fromBank(codes, [difficulty, "EASY"], 6, Date.now() % 100000);
      break;
    }
    case "MISTAKE_RETRY": {
      const conds = [eq(schema.mistakeNotebook.studentProfileId, actor.studentProfileId), eq(schema.mistakeNotebook.status, "OPEN")];
      let rows = await d.select().from(schema.mistakeNotebook).where(and(...conds)).orderBy(asc(schema.mistakeNotebook.createdAt)).limit(30);
      if (input.evaluationId) {
        const qes = await d.select({ id: schema.questionEvaluations.id }).from(schema.questionEvaluations).where(eq(schema.questionEvaluations.evaluationId, input.evaluationId));
        const ids = new Set(qes.map((q) => q.id));
        rows = rows.filter((r) => r.questionEvaluationId && ids.has(r.questionEvaluationId));
        sourceEvaluationId = input.evaluationId;
      }
      if (!rows.length) throw new AppError("NOT_FOUND", "There are no open mistakes to retry — great work!");
      drafts = rows.slice(0, 8).map((m) => ({
        topicCode: topics.find((t) => t.id === m.topicId)?.code ?? "mixed",
        difficulty: "MEDIUM",
        text: m.questionText,
        answer: m.expectedAnswer,
        accepted: [],
        solution: m.explanation,
        hint: m.mistakeType ? `Last time this was a ${m.mistakeType} mistake. Check that step carefully.` : "Look back at the step that went wrong last time.",
        mistakeId: m.id,
      }));
      break;
    }
    default: {
      const codes = topicCode ? [topicCode] : allCodes;
      if (topicCode && aiEnabled() && env().AI_PROVIDER === "gemini") {
        try {
          const t = topics.find((x) => x.code === topicCode);
          if (t) {
            const { data } = await generateQuestions({ grade: profile.grade, topicCode: t.code, topicName: t.name, difficulty, count: input.count, marksEach: 1, referenceId: `practice:${actor.studentProfileId}` });
            drafts = data.questions.map((q) => ({ topicCode: t.code, difficulty: q.difficulty, text: q.question_text, answer: q.expected_answer, accepted: q.accepted_answers, solution: q.expected_solution, hint: q.hint }));
            generatedBy = "ai";
          }
        } catch (e) {
          console.warn("[practice] AI generation failed, using question bank", e);
        }
      }
      if (!drafts.length) drafts = fromBank(codes, [difficulty], input.count, Date.now() % 100000);
    }
  }
  if (!drafts.length) throw new AppError("NOT_FOUND", "No questions are available for that choice yet.");

  const topicIdFor = (code: string) => topics.find((t) => t.code === code)?.id ?? null;
  return d.transaction(async (tx) => {
    const [session] = await tx
      .insert(schema.practiceSessions)
      .values({
        studentProfileId: actor.studentProfileId,
        familyId: actor.familyId,
        mode,
        title: mode === "CUSTOM" && topicCode ? topics.find((t) => t.code === topicCode)?.name ?? MODE_TITLES.CUSTOM : MODE_TITLES[mode],
        subjectId: subject.id,
        topicId: topicCode ? topicIdFor(topicCode) : null,
        difficulty,
        generatedBy,
        sourceEvaluationId,
        questionCount: drafts.length,
      })
      .returning();
    const qs = await tx
      .insert(schema.practiceQuestions)
      .values(
        drafts.map((q, i) => ({
          sessionId: session.id,
          position: i + 1,
          topicId: topicIdFor(q.topicCode),
          difficulty: q.difficulty,
          questionText: q.text,
          answer: q.answer,
          acceptedAnswers: q.accepted,
          solution: q.solution,
          hint: q.hint,
          mistakeId: q.mistakeId ?? null,
        })),
      )
      .returning();
    if (mode === "REVISION" || mode === "MISTAKE_RETRY") {
      await tx.insert(schema.revisionSessions).values({ studentProfileId: actor.studentProfileId, practiceSessionId: session.id, topicId: session.topicId, reason: mode === "MISTAKE_RETRY" ? "Correct previous mistakes" : "Revision of covered topics" });
    }
    return sessionDto(session, qs, topics);
  });
}

function sessionDto(
  session: typeof schema.practiceSessions.$inferSelect,
  qs: (typeof schema.practiceQuestions.$inferSelect)[],
  topics: { id: string; code: string }[],
) {
  const modeKey = (Object.entries(MODE_MAP).find(([, v]) => v === session.mode)?.[0] ?? "custom") as z.infer<typeof startPracticeSchema>["mode"];
  return {
    id: session.id,
    title: session.title,
    retryOf: session.mode === "MISTAKE_RETRY" ? session.sourceEvaluationId ?? "mistakes" : undefined,
    config: {
      subjectId: "mathematics" as const,
      topicId: topics.find((t) => t.id === session.topicId)?.code ?? "mixed",
      difficulty: session.difficulty.toLowerCase() as "easy" | "medium" | "hard",
      count: qs.length,
      mode: (modeKey === "retry" ? "revision" : modeKey) as "custom" | "daily" | "weak" | "revision" | "weekly",
    },
    // No answers or solutions here — they are revealed per question after answering.
    items: qs
      .sort((a, b) => a.position - b.position)
      .map((q) => ({ id: q.id, topicId: topics.find((t) => t.id === q.topicId)?.code ?? "mixed", difficulty: q.difficulty.toLowerCase() as "easy" | "medium" | "hard", text: q.questionText, hint: q.hint })),
  };
}

const norm = (s: string) => s.toLowerCase().replace(/[\s.,!'"]/g, "").replace(/angle$/, "");

/** Exact check first, then normalised text, then (for word answers) an AI equivalence judge. */
async function checkAnswer(actor: Actor, q: typeof schema.practiceQuestions.$inferSelect, answer: string): Promise<{ correct: boolean; method: string }> {
  for (const expected of [q.answer, ...q.acceptedAnswers]) {
    const eq = equivalentAnswers(answer, expected);
    if (eq === true) return { correct: true, method: "exact" };
    if (eq === null && norm(answer) === norm(expected)) return { correct: true, method: "normalised" };
  }
  const numericExpected = equivalentAnswers(q.answer, q.answer) !== null;
  if (numericExpected || !aiEnabled()) return { correct: false, method: numericExpected ? "exact" : "normalised" };
  try {
    await rateLimit(`judge:${actor.userId}`, 60, 3600);
    const { data } = await aiProvider().generateJson({
      purpose: "judge",
      model: models().fast,
      promptVersion: PROMPT_VERSIONS.judge,
      system: JUDGE_SYSTEM,
      schema: answerJudgeSchema,
      temperature: 0,
      parts: [{ text: `Question: ${q.questionText}\nExpected answer: ${q.answer}\nStudent answer: ${answer}` }],
      mockContext: { answer, expected: q.answer },
    });
    return { correct: data.equivalent && data.confidence >= 0.7, method: "ai_judge" };
  } catch {
    return { correct: false, method: "normalised" };
  }
}

async function loadSession(actor: Actor & { studentProfileId: string }, sessionId: string) {
  const [s] = await db().select().from(schema.practiceSessions).where(eq(schema.practiceSessions.id, sessionId));
  if (!s || s.studentProfileId !== actor.studentProfileId) throw notFound("Practice session");
  return s;
}

export async function answerQuestion(actor: Actor & { studentProfileId: string }, sessionId: string, questionId: string, input: z.infer<typeof answerSchema>) {
  const s = await loadSession(actor, sessionId);
  if (s.status !== "ACTIVE") throw conflict("This practice session is already finished.");
  const d = db();
  const [q] = await d.select().from(schema.practiceQuestions).where(and(eq(schema.practiceQuestions.id, questionId), eq(schema.practiceQuestions.sessionId, s.id)));
  if (!q) throw notFound("Question");
  const [prev] = await d.select().from(schema.practiceAnswers).where(eq(schema.practiceAnswers.questionId, q.id));
  if (prev) return { correct: prev.isCorrect, answer: q.answer, explanation: q.solution, alreadyAnswered: true };
  const { correct, method } = await checkAnswer(actor, q, input.answer);
  await d
    .insert(schema.practiceAnswers)
    .values({ sessionId: s.id, questionId: q.id, answer: input.answer, steps: input.steps, isCorrect: correct, verificationMethod: method, timeSpentSeconds: input.timeSpentSeconds })
    .onConflictDoNothing();
  return { correct, answer: q.answer, explanation: q.solution, alreadyAnswered: false };
}

/** Completes a session: correctness, XP and streak come from stored answers only. */
export async function completeSession(actor: Actor & { studentProfileId: string }, sessionId: string) {
  const s = await loadSession(actor, sessionId);
  const d = db();
  const qs = await d.select().from(schema.practiceQuestions).where(eq(schema.practiceQuestions.sessionId, s.id));
  const answers = await d.select().from(schema.practiceAnswers).where(eq(schema.practiceAnswers.sessionId, s.id));
  if (s.status === "COMPLETED") return resultDto(s, qs, answers);
  if (answers.length < Math.ceil(qs.length / 2)) throw new AppError("VALIDATION", "Answer at least half of the questions to finish this session.");
  const correct = answers.filter((a) => a.isCorrect).length;
  const timeSpent = answers.reduce((sum, a) => sum + a.timeSpentSeconds, 0);

  const updated = await d.transaction(async (tx) => {
    const [locked] = await tx.update(schema.practiceSessions).set({ status: "COMPLETED", completedAt: new Date(), correctCount: correct, timeSpentSeconds: timeSpent }).where(and(eq(schema.practiceSessions.id, s.id), eq(schema.practiceSessions.status, "ACTIVE"))).returning();
    if (!locked) return null; // completed concurrently
    const fam = await familyContext(tx, s.studentProfileId);
    const today = localDateIn(fam.timezone);
    const minutes = Math.max(1, Math.round(timeSpent / 60) || qs.length * 2);
    let xp = 0;

    if (s.mode === "MISTAKE_RETRY") {
      const fixed = answers.filter((a) => a.isCorrect).map((a) => qs.find((q) => q.id === a.questionId)!).filter((q) => q.mistakeId);
      if (fixed.length) {
        await tx.update(schema.mistakeNotebook).set({ status: "CORRECTED", correctedAt: new Date() }).where(inArray(schema.mistakeNotebook.id, fixed.map((q) => q.mistakeId!)));
      }
      const tried = qs.filter((q) => q.mistakeId && answers.some((a) => a.questionId === q.id));
      for (const q of tried) {
        const [m] = await tx.select({ attempts: schema.mistakeNotebook.attempts }).from(schema.mistakeNotebook).where(eq(schema.mistakeNotebook.id, q.mistakeId!));
        if (m) await tx.update(schema.mistakeNotebook).set({ attempts: m.attempts + 1 }).where(eq(schema.mistakeNotebook.id, q.mistakeId!));
      }
      for (const q of fixed) {
        xp += await awardXp(tx, { studentProfileId: s.studentProfileId, ruleKey: "MISTAKE_CORRECTED", amount: fam.rules.MISTAKE_CORRECTED, sourceType: "mistake", sourceId: q.mistakeId!, description: "Corrected a previous mistake" });
      }
      if (fixed.length) {
        await recordActivity(tx, { studentProfileId: s.studentProfileId, familyId: fam.familyId, timezone: fam.timezone, type: "MISTAKES_CORRECTED", sourceType: "practice_session", sourceId: s.id, minutes, dailyGoalMinutes: fam.dailyGoalMinutes, metadata: { corrected: fixed.length } });
      }
      await tx.update(schema.revisionSessions).set({ status: "COMPLETED", completedAt: new Date() }).where(eq(schema.revisionSessions.practiceSessionId, s.id));
    } else {
      await recordActivity(tx, { studentProfileId: s.studentProfileId, familyId: fam.familyId, timezone: fam.timezone, type: s.mode === "REVISION" ? "REVISION_COMPLETED" : "PRACTICE_COMPLETED", sourceType: "practice_session", sourceId: s.id, minutes, dailyGoalMinutes: fam.dailyGoalMinutes });
      if (s.mode === "DAILY") {
        xp += await awardXp(tx, { studentProfileId: s.studentProfileId, ruleKey: "DAILY_CHALLENGE", amount: fam.rules.DAILY_CHALLENGE, sourceType: "daily_challenge", sourceId: today, description: "Daily challenge" });
      } else if (s.mode === "WEEKLY") {
        if (answers.length === qs.length) {
          xp += await awardXp(tx, { studentProfileId: s.studentProfileId, ruleKey: "WEEKLY_CHALLENGE", amount: fam.rules.WEEKLY_CHALLENGE, sourceType: "weekly_challenge", sourceId: weekStartOf(today), description: "Weekly challenge completed" });
        }
      } else if (await practiceXpAllowed(tx, s.studentProfileId, fam.timezone)) {
        xp += await awardXp(tx, { studentProfileId: s.studentProfileId, ruleKey: "PRACTICE_COMPLETED", amount: fam.rules.PRACTICE_COMPLETED, sourceType: "practice_session", sourceId: s.id, description: `${s.title} practice` });
      }
      if (s.mode === "REVISION") await tx.update(schema.revisionSessions).set({ status: "COMPLETED", completedAt: new Date() }).where(eq(schema.revisionSessions.practiceSessionId, s.id));
    }

    // Topic mastery from answered questions, grouped by topic.
    const byTopic = new Map<string, { n: number; c: number }>();
    for (const a of answers) {
      const q = qs.find((x) => x.id === a.questionId);
      if (!q?.topicId) continue;
      const t = byTopic.get(q.topicId) ?? { n: 0, c: 0 };
      t.n++;
      if (a.isCorrect) t.c++;
      byTopic.set(q.topicId, t);
    }
    for (const [topicId, t] of byTopic) {
      await recordTopicAttempt(tx, { studentProfileId: s.studentProfileId, topicId, scorePct: (t.c / t.n) * 100, questions: t.n, correct: t.c, errorTypes: [], isRevision: s.mode === "REVISION" || s.mode === "MISTAKE_RETRY" });
    }
    await tx.update(schema.practiceSessions).set({ xpAwarded: xp }).where(eq(schema.practiceSessions.id, s.id));
    await afterProgress(tx, s.studentProfileId, fam.timezone);
    return { ...locked, xpAwarded: xp };
  });
  return resultDto(updated ?? (await loadSession(actor, sessionId)), qs, answers);
}

function resultDto(s: typeof schema.practiceSessions.$inferSelect, qs: (typeof schema.practiceQuestions.$inferSelect)[], answers: (typeof schema.practiceAnswers.$inferSelect)[]) {
  return {
    id: s.id,
    correct: answers.filter((a) => a.isCorrect).length,
    total: qs.length,
    xpEarned: s.xpAwarded,
    completedAt: (s.completedAt ?? new Date()).toISOString(),
    review: qs
      .sort((a, b) => a.position - b.position)
      .map((q) => {
        const a = answers.find((x) => x.questionId === q.id);
        return { questionId: q.id, text: q.questionText, answer: q.answer, studentAnswer: a?.answer ?? "", correct: a?.isCorrect ?? false };
      }),
  };
}

export async function abandonSession(actor: Actor & { studentProfileId: string }, sessionId: string) {
  const s = await loadSession(actor, sessionId);
  if (s.status === "ACTIVE") await db().update(schema.practiceSessions).set({ status: "ABANDONED" }).where(and(eq(schema.practiceSessions.id, s.id), isNull(schema.practiceSessions.completedAt)));
}
