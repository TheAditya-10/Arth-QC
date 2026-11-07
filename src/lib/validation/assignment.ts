import { z } from "zod";

export const rubricStepSchema = z.object({
  description: z.string().trim().min(2).max(200),
  marks: z.coerce.number().positive().max(100),
});

export const apiQuestionSchema = z
  .object({
    text: z.string().trim().min(5).max(2000),
    marks: z.coerce.number().positive().max(100),
    expectedAnswer: z.string().trim().min(1).max(1000),
    expectedSolution: z.string().trim().max(4000).optional().default(""),
    difficulty: z.enum(["easy", "medium", "hard"]).optional(),
    rubric: z.array(rubricStepSchema).max(10).optional().default([]),
  })
  .refine((q) => q.rubric.length === 0 || Math.abs(q.rubric.reduce((s, r) => s + r.marks, 0) - q.marks) < 0.01, {
    message: "Marking steps must add up to the question's marks",
    path: ["rubric"],
  });

export const apiAssignmentSchema = z.object({
  studentProfileId: z.string().uuid().optional(),
  title: z.string().trim().min(3).max(120),
  subjectId: z.enum(["mathematics", "science", "english"]).default("mathematics"),
  topicId: z.string().trim().min(1).max(64),
  grade: z.coerce.number().int().min(1).max(12),
  description: z.string().trim().min(10).max(2000),
  instructions: z.array(z.string().trim().min(1).max(300)).max(15).default([]),
  questions: z.array(apiQuestionSchema).min(1).max(25),
  difficulty: z.enum(["easy", "medium", "hard"]),
  estimatedMinutes: z.coerce.number().int().min(5).max(180),
  dueDate: z.string().datetime({ offset: true }),
  markingScheme: z.string().trim().max(2000).optional().default(""),
  allowAlternativeMethods: z.boolean().default(true),
  source: z.enum(["manual", "ai"]).default("manual"),
  attachmentUploadIds: z.array(z.string().uuid()).max(5).default([]),
});
export type ApiAssignmentInput = z.infer<typeof apiAssignmentSchema>;

export const generateAssignmentSchema = z.object({
  topicId: z.string().trim().min(1).max(64),
  grade: z.coerce.number().int().min(1).max(12).default(6),
  difficulty: z.enum(["easy", "medium", "hard"]),
  count: z.coerce.number().int().min(1).max(15),
  marksEach: z.coerce.number().int().min(1).max(20),
  questionTypes: z.array(z.string().trim().max(60)).max(5).optional(),
});
