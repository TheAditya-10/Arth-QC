import { z } from "zod";

export const parentPassword = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(128)
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/[0-9]/, "Include at least one number");

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: parentPassword,
  familyName: z.string().trim().min(2, "Enter a family name").max(80),
  relation: z.enum(["Mother", "Father", "Guardian"]).default("Guardian"),
  timezone: z.string().trim().max(64).default("Asia/Kolkata"),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const studentPin = z.string().regex(/^\d{6,8}$/, "PIN must be 6–8 digits");
export const studentUsername = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "At least 3 characters")
  .max(24)
  .regex(/^[a-z0-9_.]+$/, "Use lowercase letters, numbers, dots or underscores");

export const createStudentSchema = z.object({
  displayName: z.string().trim().min(2).max(40),
  username: studentUsername,
  pin: studentPin,
  grade: z.coerce.number().int().min(1).max(12).default(6),
  school: z.string().trim().max(80).default(""),
});

export const resetPinSchema = z.object({ pin: studentPin });

export const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  relation: z.enum(["Mother", "Father", "Guardian"]).default("Guardian"),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(20).max(200),
  name: z.string().trim().min(2).max(80).optional(),
  password: parentPassword.optional(),
});

export const studentProfileUpdateSchema = z.object({
  displayName: z.string().trim().min(2).max(40),
  grade: z.coerce.number().int().min(1).max(12),
  curriculum: z.enum(["NCERT", "CBSE", "ICSE", "State Board"]),
  school: z.string().trim().max(80).default(""),
  dailyGoalMinutes: z.coerce.number().int().min(10).max(180),
});

export const parentProfileUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  relation: z.enum(["Mother", "Father", "Guardian"]),
});
