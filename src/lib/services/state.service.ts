import "server-only";
import { and, asc, desc, eq, gte, inArray, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { linkedStudents, resolveStudentId, type Actor } from "@/lib/security/actor";
import { signedViewUrl } from "@/lib/storage/upload.service";
import { addDaysStr, localDateIn } from "@/lib/utils/timezone";
import type {
  Achievement,
  AppPreferences,
  Assignment,
  AssignmentStatus,
  ChatMessage,
  ErrorKind,
  Evaluation,
  EvaluationStatus,
  NotificationPreferences,
  PendingInvitation,
  PracticeResult,
  QuestionResult,
  ReportHistoryItem,
  ReportSettings,
  Reward,
  StudentProfile,
  Submission,
  TopicProgress,
  User,
  WeeklyReport,
  XPEvent,
} from "@/types";
import { computeMetrics, effectiveStreak, levelFor } from "./gamification";
import { displayMastery, recommendationsFor, topicProgressFor } from "./progress";
import { rewardsForStudent } from "./reward.service";
import { currentReportPreview, reportHistory } from "./report.service";
import { listInvitations } from "./account.service";
import { MODE_TITLES } from "./practice.service";
import { fromDbDifficulty } from "./catalog";

export type { AppState } from "@/types/app-state";
import type { AppState } from "@/types/app-state";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const ERROR_KINDS: ErrorKind[] = ["conceptual", "calculation", "incomplete", "notation", "method", "misread"];

function uiEvalStatus(s: string, reviewed: boolean): EvaluationStatus {
  if (s === "COMPLETED") return reviewed ? "reviewed" : "evaluated";
  if (s === "NEEDS_REVIEW") return "needs_review";
  if (s === "FAILED") return "failed";
  return "processing";
}

export async function buildState(actor: Actor, requestedStudentId?: string | null): Promise<AppState> {
  const d = db();
  const studentId = await resolveStudentId(actor, requestedStudentId);
  const [profile] = await d.select().from(schema.studentProfiles).where(eq(schema.studentProfiles.id, studentId));
  const [studentUser] = await d.select().from(schema.users).where(eq(schema.users.id, profile.userId));
  const [family] = await d.select().from(schema.families).where(eq(schema.families.id, profile.familyId));
  const [curriculum] = profile.curriculumId ? await d.select().from(schema.curricula).where(eq(schema.curricula.id, profile.curriculumId)) : [];
  const tz = family.timezone;
  const today = localDateIn(tz);
  const isParent = actor.role !== "STUDENT";

  // ---- Family members ----
  const members = await d
    .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email, role: schema.familyMembers.role, relation: schema.familyMembers.relation })
    .from(schema.familyMembers)
    .innerJoin(schema.users, eq(schema.users.id, schema.familyMembers.userId))
    .where(and(eq(schema.familyMembers.familyId, family.id), eq(schema.familyMembers.status, "ACTIVE")))
    .orderBy(asc(schema.familyMembers.createdAt));
  const users: User[] = members
    .filter((m) => isParent || m.role === "PARENT" || m.id === actor.userId)
    .map((m, i) => ({
      id: m.id,
      name: m.name,
      // Students never see parents' email addresses.
      email: isParent || m.id === actor.userId ? (m.role === "STUDENT" ? "" : m.email) : "",
      role: m.role === "PARENT" ? "parent" : "student",
      avatarColor: m.role === "STUDENT" ? "#FFD66B" : ["#BCEBD6", "#FF9C88", "#EEEAFE"][i % 3],
      relation: (m.relation as User["relation"]) ?? undefined,
    }));
  const students = isParent ? await linkedStudents(actor) : [{ id: profile.id, displayName: profile.displayName, grade: profile.grade }];
  const studentUsernames = isParent && students.length
    ? await d.select({ id: schema.studentProfiles.id, username: schema.users.username }).from(schema.studentProfiles).innerJoin(schema.users, eq(schema.users.id, schema.studentProfiles.userId)).where(inArray(schema.studentProfiles.id, students.map((s) => s.id)))
    : [];

  // ---- Topics / progress ----
  const topics = await d.select().from(schema.topics);
  const topicCode = (id: string | null) => topics.find((t) => t.id === id)?.code ?? "mixed";
  const tp = await topicProgressFor(d, studentId, profile.grade);
  const topicProgress: TopicProgress[] = tp.map((t) => {
    const scores = (t.recentScores as number[]) ?? [];
    const last = scores[scores.length - 1];
    const prev = scores[scores.length - 2];
    return {
      topicId: t.code,
      topicName: t.topicName,
      accuracy: Math.round(Number(t.accuracy)),
      mastery: displayMastery(t.masteryLevel as never, Number(t.masteryScore)),
      attempts: Number(t.totalAttempts),
      trend: last === undefined || prev === undefined ? "flat" : last > prev + 2 ? "up" : last < prev - 2 ? "down" : "flat",
      masteryLevel: t.masteryLevel as TopicProgress["masteryLevel"],
    };
  });

  // ---- Assignments + submissions + evaluations ----
  const aRows = await d
    .select()
    .from(schema.assignments)
    .where(and(eq(schema.assignments.studentProfileId, studentId), isNull(schema.assignments.deletedAt)))
    .orderBy(desc(schema.assignments.dueAt));
  const aIds = aRows.map((a) => a.id);
  const qRows = aIds.length ? await d.select().from(schema.assignmentQuestions).where(inArray(schema.assignmentQuestions.assignmentId, aIds)).orderBy(asc(schema.assignmentQuestions.position)) : [];
  const rubricRows = qRows.length
    ? await d.select().from(schema.markingRubrics).where(and(inArray(schema.markingRubrics.questionId, qRows.map((q) => q.id)), eq(schema.markingRubrics.isActive, true), eq(schema.markingRubrics.source, "PARENT")))
    : [];
  const attachments = aIds.length ? await d.select().from(schema.assignmentAttachments).where(inArray(schema.assignmentAttachments.assignmentId, aIds)) : [];
  const sRows = await d
    .select()
    .from(schema.submissions)
    .where(and(eq(schema.submissions.studentProfileId, studentId), isNull(schema.submissions.deletedAt)))
    .orderBy(desc(schema.submissions.submittedAt));
  const sIds = sRows.map((s) => s.id);
  const fRows = sIds.length ? await d.select().from(schema.submissionFiles).where(inArray(schema.submissionFiles.submissionId, sIds)).orderBy(asc(schema.submissionFiles.pageOrder)) : [];
  const eRows = sIds.length ? await d.select().from(schema.evaluations).where(and(inArray(schema.evaluations.submissionId, sIds), eq(schema.evaluations.isCurrent, true))) : [];
  const eIds = eRows.map((e) => e.id);
  const qeRows = eIds.length ? await d.select().from(schema.questionEvaluations).where(inArray(schema.questionEvaluations.evaluationId, eIds)).orderBy(asc(schema.questionEvaluations.position)) : [];
  const stepRows = qeRows.length ? await d.select().from(schema.evaluationSteps).where(inArray(schema.evaluationSteps.questionEvaluationId, qeRows.map((q) => q.id))).orderBy(asc(schema.evaluationSteps.position)) : [];
  const corrRows = eIds.length
    ? await d
        .select({ c: schema.evaluationCorrections, by: schema.users.name })
        .from(schema.evaluationCorrections)
        .innerJoin(schema.users, eq(schema.users.id, schema.evaluationCorrections.correctedBy))
        .where(inArray(schema.evaluationCorrections.evaluationId, eIds))
        .orderBy(desc(schema.evaluationCorrections.createdAt))
    : [];
  const jobs = isParent && sIds.length ? await d.select().from(schema.evaluationJobs).where(inArray(schema.evaluationJobs.submissionId, sIds)) : [];

  const latestSubFor = (assignmentId: string) => sRows.find((s) => s.assignmentId === assignmentId);
  const assignments: Assignment[] = await Promise.all(aRows.map(async (a) => {
    const sub = latestSubFor(a.id);
    let status: AssignmentStatus = a.startedAt ? "in_progress" : "pending";
    if (sub) {
      if (sub.status === "COMPLETED" || sub.status === "NEEDS_REVIEW") status = "evaluated";
      else if (sub.status !== "FAILED") status = "submitted";
    }
    const att = attachments.filter((x) => x.assignmentId === a.id);
    return {
      id: a.id,
      title: a.title,
      subjectId: "mathematics",
      topicId: topicCode(a.topicId),
      grade: a.grade,
      description: a.description,
      instructions: a.instructions,
      questions: qRows
        .filter((q) => q.assignmentId === a.id)
        .map((q) => ({
          id: q.id,
          number: q.position,
          text: q.questionText,
          marks: q.maxMarks,
          // Students never receive the answer key.
          expectedAnswer: isParent ? q.expectedAnswer : "",
          markingSteps: isParent ? rubricRows.find((r) => r.questionId === q.id)?.steps : undefined,
          expectedSolution: isParent ? q.expectedSolution ?? "" : undefined,
        })),
      maxMarks: a.totalMarks,
      difficulty: fromDbDifficulty(a.difficulty),
      estimatedMinutes: a.estimatedMinutes,
      dueDate: a.dueAt.toISOString(),
      createdAt: a.createdAt.toISOString(),
      createdBy: a.createdBy ?? "",
      source: a.source === "AI" ? "ai" : "manual",
      markingScheme: a.markingConfig.markingScheme,
      referenceFileName: att[0]?.fileName,
      attachments: await Promise.all(att.map(async (x) => ({ id: x.id, name: x.fileName, url: await signedViewUrl(x.storageKey, x.fileName) }))),
      status,
      progress: a.startedAt && status === "in_progress" ? 25 : undefined,
    };
  }));

  const submissions: Submission[] = await Promise.all(
    sRows.map(async (s) => {
      const ev = eRows.find((e) => e.submissionId === s.id);
      const job = jobs.find((j) => j.submissionId === s.id);
      return {
        id: s.id,
        assignmentId: s.assignmentId,
        studentId: s.studentProfileId,
        submittedAt: s.submittedAt.toISOString(),
        notes: s.notes ?? undefined,
        status: uiEvalStatus(s.status, Boolean(ev?.reviewedAt)),
        evaluationId: ev?.id,
        rawStatus: s.status,
        jobError: isParent ? job?.lastError ?? undefined : undefined,
        files: await Promise.all(
          fRows
            .filter((f) => f.submissionId === s.id)
            .map(async (f) => ({
              id: f.id,
              name: f.fileName,
              kind: f.mimeType === "application/pdf" ? ("pdf" as const) : ("image" as const),
              size: f.sizeBytes,
              previewUrl: await signedViewUrl(f.storageKey, f.fileName),
            })),
        ),
      };
    }),
  );

  const evaluations: Evaluation[] = eRows.map((e) => {
    const sub = sRows.find((s) => s.id === e.submissionId)!;
    const corr = corrRows.filter((c) => c.c.evaluationId === e.id);
    const results: QuestionResult[] = qeRows
      .filter((q) => q.evaluationId === e.id)
      .map((q) => {
        const qq = qRows.find((x) => x.id === q.questionId);
        return {
          questionId: q.questionId,
          questionEvaluationId: q.id,
          number: q.position,
          question: qq?.questionText ?? "",
          studentAnswer: q.extractedAnswer || "(no answer found)",
          expectedAnswer: q.expectedAnswer,
          marksAwarded: q.awardedMarks,
          aiMarks: q.aiMarks,
          maxMarks: q.maxMarks,
          status: q.result === "CORRECT" ? "correct" : q.result === "PARTIAL" ? "partial" : "incorrect",
          steps: stepRows
            .filter((st) => st.questionEvaluationId === q.id)
            .map((st) => ({ description: st.description, awarded: st.awardedMarks, max: st.maxMarks, ok: st.status === "CORRECT" })),
          errors: q.mistakeTypes
            .filter((k): k is ErrorKind => ERROR_KINDS.includes(k as ErrorKind))
            .map((k, i) => ({ kind: k, description: i === 0 ? q.mistakeDescription ?? "" : "" }))
            .filter((x) => x.description || q.mistakeTypes.length === 1),
          explanation: q.explanation,
          feedback: q.feedback,
          recommendedPractice: q.recommendedPractice,
          needsReview: q.needsReview,
          confidence: q.confidence,
          verificationNote: isParent ? q.verification?.note : undefined,
        };
      });
    return {
      id: e.id,
      submissionId: e.submissionId,
      assignmentId: sub.assignmentId,
      score: e.aiScore,
      maxScore: e.maxScore,
      xpEarned: e.xpAwarded,
      evaluatedAt: e.createdAt.toISOString(),
      results,
      strengths: e.strengths,
      needsAttention: e.needsAttention,
      suggestedPractice: e.suggestedPractice,
      summary: e.summary,
      parentOverride:
        e.reviewedAt && (corr.length || Math.abs(e.score - e.aiScore) > 0.001)
          ? { score: e.score, note: corr[0]?.c.reason ?? "", at: e.reviewedAt.toISOString(), originalScore: e.aiScore }
          : undefined,
      needsReview: e.needsReview,
      reviewReasons: isParent ? e.reviewReasons : undefined,
      confidence: e.confidence,
      model: isParent ? e.model : undefined,
      promptVersion: isParent ? e.promptVersion : undefined,
      corrections: isParent
        ? corr.map((c) => ({
            questionNumber: qeRows.find((q) => q.id === c.c.questionEvaluationId)?.position ?? 0,
            previousMarks: c.c.previousMarks,
            newMarks: c.c.newMarks,
            reason: c.c.reason,
            at: c.c.createdAt.toISOString(),
            by: c.by,
          }))
        : undefined,
    };
  });

  // ---- Gamification ----
  const metrics = await computeMetrics(d, studentId, tz);
  const [streak] = await d.select().from(schema.studentStreaks).where(eq(schema.studentStreaks.studentProfileId, studentId));
  const activity = await d
    .select({ day: schema.learningActivityLogs.localDate, minutes: schema.learningActivityLogs.minutes })
    .from(schema.learningActivityLogs)
    .where(and(eq(schema.learningActivityLogs.studentProfileId, studentId), gte(schema.learningActivityLogs.localDate, addDaysStr(today, -70))));
  const studyMinutes: Record<string, number> = {};
  for (const a of activity) studyMinutes[a.day] = (studyMinutes[a.day] ?? 0) + Math.max(1, a.minutes);
  const allDays = await d
    .selectDistinct({ day: schema.learningActivityLogs.localDate })
    .from(schema.learningActivityLogs)
    .where(eq(schema.learningActivityLogs.studentProfileId, studentId));

  const defs = await d.select().from(schema.achievements).where(eq(schema.achievements.active, true)).orderBy(asc(schema.achievements.sortOrder));
  const sa = await d.select().from(schema.studentAchievements).where(eq(schema.studentAchievements.studentProfileId, studentId));
  const metricFor = (rule: string) =>
    rule === "streak" ? Math.max(metrics.streak, metrics.longest_streak) : ((metrics as unknown as Record<string, number>)[rule] ?? 0);
  const achievements: Achievement[] = defs.map((a) => {
    const un = sa.find((x) => x.achievementId === a.id);
    return {
      id: a.code,
      title: a.title,
      description: a.description,
      icon: a.icon,
      category: a.category as Achievement["category"],
      xpReward: a.xpReward,
      current: un ? a.threshold : Math.min(a.threshold, Math.round(metricFor(a.ruleType))),
      target: a.threshold,
      unlockedAt: un?.unlockedAt.toISOString(),
    };
  });
  const celebrations = actor.role === "STUDENT" ? sa.filter((x) => !x.celebratedAt).map((x) => defs.find((a) => a.id === x.achievementId)?.code).filter((x): x is string => Boolean(x)) : [];

  const rewardItems = await rewardsForStudent(studentId, family.id, tz);
  const rewards: Reward[] = rewardItems.map((r) => ({
    id: r.definition.id,
    title: r.definition.title,
    description: r.definition.description,
    trigger: r.definition.triggerType.toLowerCase() as Reward["trigger"],
    threshold: r.definition.threshold,
    status: r.status,
    emoji: r.definition.emoji,
    createdBy: r.definition.createdBy ?? "",
    unlockedAt: r.redemption?.decidedAt?.toISOString() ?? r.redemption?.requestedAt.toISOString(),
    deliveredAt: r.redemption?.deliveredAt?.toISOString(),
    requestedAt: r.redemption?.status === "REQUESTED" ? r.redemption.requestedAt.toISOString() : undefined,
    progress: r.progress,
  }));

  const xpRows = await d.select().from(schema.xpTransactions).where(eq(schema.xpTransactions.studentProfileId, studentId)).orderBy(desc(schema.xpTransactions.createdAt)).limit(30);
  const kindFor = (rule: string): XPEvent["kind"] =>
    rule.startsWith("ACHIEVEMENT") ? "achievement" : rule === "MISTAKE_CORRECTED" ? "correction" : rule.startsWith("HOMEWORK") || rule.startsWith("SCORE") ? "assignment" : "practice";
  const xpEvents: XPEvent[] = xpRows.map((x) => ({ id: x.id, label: x.description, xp: x.amount, at: x.createdAt.toISOString(), kind: kindFor(x.ruleKey) }));

  const pRows = await d
    .select()
    .from(schema.practiceSessions)
    .where(and(eq(schema.practiceSessions.studentProfileId, studentId), eq(schema.practiceSessions.status, "COMPLETED")))
    .orderBy(desc(schema.practiceSessions.completedAt))
    .limit(20);
  const modeKey = { CUSTOM: "custom", DAILY: "daily", WEAK_TOPIC: "weak", REVISION: "revision", WEEKLY: "weekly", MISTAKE_RETRY: "revision" } as const;
  const practiceResults: PracticeResult[] = pRows.map((p) => ({
    id: p.id,
    config: { subjectId: "mathematics", topicId: topicCode(p.topicId), difficulty: fromDbDifficulty(p.difficulty), count: p.questionCount, mode: modeKey[p.mode] },
    attempts: [],
    correct: p.correctCount,
    total: p.questionCount,
    xpEarned: p.xpAwarded,
    completedAt: (p.completedAt ?? p.startedAt).toISOString(),
    title: p.mode === "MISTAKE_RETRY" ? MODE_TITLES.MISTAKE_RETRY : undefined,
  }));

  // ---- Preferences ----
  const [np] = await d.select().from(schema.notificationPreferences).where(eq(schema.notificationPreferences.userId, actor.userId));
  const notificationPrefs: NotificationPreferences = {
    submissionEvaluated: np?.submissionEvaluated ?? true,
    deadlineReminders: np?.deadlineReminders ?? true,
    streakAlerts: np?.streakAlerts ?? true,
    achievementUnlocked: np?.achievementUnlocked ?? true,
    weakTopicAlerts: np?.weakTopicAlerts ?? false,
  };
  const ap = np?.appPreferences ?? { soundEffects: true, showMotivation: true, celebrations: true, aiHintLevel: "gentle" as const };
  // Hint style is set by parents and applies to the student, so students read their own row.
  const appPrefs: AppPreferences = {
    soundEffects: ap.soundEffects,
    reducedMotion: false,
    showLeaderboardHints: ap.showMotivation,
    aiHintLevel: ap.aiHintLevel,
    celebrations: ap.celebrations,
    autoUnlockRewards: family.autoUnlockRewards,
  };

  // ---- Reports (parents only) ----
  let pastReports: ReportHistoryItem[] = [];
  let currentReport: WeeklyReport | null = null;
  let reportSettings: AppState["reportSettings"] = { enabled: false, day: "Sunday", time: "19:00", recipients: [], includeTopicBreakdown: true, includeMistakes: true };
  let invitations: PendingInvitation[] = [];
  if (isParent) {
    const hist = await reportHistory(actor, studentId);
    pastReports = hist.map((r) => ({ id: r.id, weekStart: `${r.weekStart}T00:00:00`, weekEnd: `${r.weekEnd}T00:00:00`, ...r.data, status: r.status, deliveries: r.deliveries.map((x) => ({ ...x, sentAt: x.sentAt?.toISOString() ?? null })) }));
    const cur = await currentReportPreview(actor, studentId);
    currentReport = { id: "current", weekStart: `${cur.weekStart}T00:00:00`, weekEnd: `${cur.weekEnd}T00:00:00`, ...cur.data };
    const recipients = await d.select().from(schema.reportRecipients).where(eq(schema.reportRecipients.familyId, family.id)).orderBy(asc(schema.reportRecipients.createdAt));
    const [lastTest] = await d
      .select({ at: schema.emailDeliveryLogs.createdAt })
      .from(schema.emailDeliveryLogs)
      .where(and(eq(schema.emailDeliveryLogs.familyId, family.id), eq(schema.emailDeliveryLogs.template, "weekly_report_test")))
      .orderBy(desc(schema.emailDeliveryLogs.createdAt))
      .limit(1);
    reportSettings = {
      enabled: family.reportEnabled,
      day: (["Sunday", "Monday", "Friday", "Saturday"].includes(DAY_NAMES[family.reportDay]) ? DAY_NAMES[family.reportDay] : "Sunday") as ReportSettings["day"],
      time: family.reportTime,
      recipients: recipients.map((r) => ({ id: r.id, name: r.name, email: r.email, enabled: r.enabled })),
      includeTopicBreakdown: family.reportIncludeTopics,
      includeMistakes: family.reportIncludeMistakes,
      lastSentAt: lastTest?.at.toISOString(),
    };
    invitations = (await listInvitations(actor)).map((i) => ({ id: i.id, email: i.email, expiresAt: i.expiresAt.toISOString() }));
  }

  // ---- Chat (student only) ----
  let chat: ChatMessage[] = [];
  if (actor.role === "STUDENT") {
    const rows = await d.select().from(schema.buddyMessages).where(eq(schema.buddyMessages.studentProfileId, studentId)).orderBy(desc(schema.buddyMessages.createdAt)).limit(60);
    chat = [
      {
        id: "welcome",
        role: "buddy",
        text: `Hi ${profile.displayName.split(" ")[0]}! I'm Arthu, your maths buddy. 🦉 I won't just tell you answers — I'll give you hints so YOU can crack it. What shall we explore today?`,
        at: profile.createdAt.toISOString(),
      },
      ...rows.reverse().map((m) => ({ id: m.id, role: m.role === "STUDENT" ? ("student" as const) : ("buddy" as const), text: m.content, at: m.createdAt.toISOString() })),
    ];
  }

  const recs = await recommendationsFor(d, studentId, profile.grade);
  const xp = profile.xpTotal;
  const student: StudentProfile = {
    id: profile.id,
    userId: profile.userId,
    name: profile.displayName,
    grade: profile.grade,
    curriculum: (curriculum?.code as StudentProfile["curriculum"]) ?? "NCERT",
    school: profile.school,
    subjects: ["mathematics"],
    dailyGoalMinutes: profile.dailyGoalMinutes,
    xp,
    level: levelFor(xp),
    streak: streak ? effectiveStreak(streak, today) : 0,
    longestStreak: streak?.longestStreak ?? 0,
    studyDays: allDays.map((x) => x.day),
    joinedAt: profile.createdAt.toISOString(),
    mistakesCorrected: metrics.mistakes_corrected,
  };

  return {
    version: Date.now(),
    viewer: {
      userId: actor.userId,
      role: actor.role === "STUDENT" ? "student" : "parent",
      name: actor.name,
      email: actor.role === "STUDENT" ? "" : actor.email,
      familyId: family.id,
      familyName: family.name,
      timezone: tz,
      students: students.map((s) => ({ id: s.id, name: s.displayName, grade: s.grade, username: studentUsernames.find((u) => u.id === s.id)?.username ?? (actor.role === "STUDENT" ? studentUser.username : null) })),
      activeStudentId: studentId,
    },
    users,
    student,
    assignments,
    submissions,
    evaluations,
    topicProgress,
    achievements,
    rewards,
    xpEvents,
    practiceResults,
    pastReports,
    currentReport,
    reportSettings,
    notificationPrefs,
    appPrefs,
    chat,
    celebrations,
    studyMinutes,
    recommendations: recs.slice(0, 5).map((r) => ({ topicId: topicCode(r.topicId), topicName: r.topicName, difficulty: fromDbDifficulty(r.difficulty), reason: r.reason })),
    invitations,
  };
}
