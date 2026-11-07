import { z } from "zod";

export const questionSchema = z.object({
  text: z.string().trim().min(5, "Write the question (at least 5 characters)"),
  marks: z.coerce.number().int().min(1, "Min 1").max(50, "Max 50"),
  expectedAnswer: z.string().trim().min(1, "Add the expected answer"),
});

export const assignmentSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(80),
  subjectId: z.enum(["mathematics", "science", "english"]),
  topicId: z.string().min(1, "Choose a topic"),
  grade: z.coerce.number().int().min(1).max(12),
  description: z.string().trim().min(10, "Describe the assignment in a sentence or two"),
  instructions: z.string().trim().default(""),
  questions: z.array(questionSchema).min(1, "Add at least one question").max(25),
  difficulty: z.enum(["easy", "medium", "hard"]),
  estimatedMinutes: z.coerce.number().int().min(5, "At least 5 minutes").max(180),
  dueDate: z
    .string()
    .min(1, "Pick a due date")
    .refine((v) => !Number.isNaN(new Date(v).getTime()), "Invalid date"),
  markingScheme: z.string().optional().default(""),
  referenceFileName: z.string().optional().default(""),
  source: z.enum(["manual", "ai"]),
});

export type AssignmentFormValues = z.infer<typeof assignmentSchema>;
export type AssignmentFormInput = z.input<typeof assignmentSchema>;

export const rewardSchema = z.object({
  title: z.string().trim().min(3, "Give the reward a name").max(60),
  description: z.string().trim().max(140).default(""),
  trigger: z.enum(["streak", "xp", "score", "improvement", "custom"]),
  threshold: z.coerce.number().int().min(0).max(100000),
  emoji: z.string().min(1).max(4),
});
export type RewardFormValues = z.infer<typeof rewardSchema>;
export type RewardFormInput = z.input<typeof rewardSchema>;

export const studentProfileSchema = z.object({
  name: z.string().trim().min(2, "Enter a name").max(40),
  grade: z.coerce.number().int().min(1).max(12),
  curriculum: z.enum(["NCERT", "CBSE", "ICSE", "State Board"]),
  school: z.string().trim().max(80).default(""),
  dailyGoalMinutes: z.coerce.number().int().min(10).max(180),
});
export type StudentProfileValues = z.infer<typeof studentProfileSchema>;
export type StudentProfileInput = z.input<typeof studentProfileSchema>;

export const parentProfileSchema = z.object({
  name: z.string().trim().min(2, "Enter a name"),
  email: z.string().trim().email("Enter a valid email"),
  relation: z.enum(["Mother", "Father", "Guardian"]),
});
export type ParentProfileValues = z.infer<typeof parentProfileSchema>;
