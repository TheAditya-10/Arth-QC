import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { appUrl, env } from "@/lib/env";

/** Lockout policy. Students use short PINs, so they get a stricter limit. */
export const LOCKOUT = {
  STUDENT: { maxAttempts: 5, lockMinutes: 15 },
  PARENT: { maxAttempts: 8, lockMinutes: 15 },
} as const;

const SIGN_IN_PATHS = new Set(["/sign-in/email", "/sign-in/username"]);

async function findLoginUser(body: Record<string, unknown> | undefined) {
  if (!body) return null;
  const d = db();
  if (typeof body.username === "string") {
    const [u] = await d.select().from(schema.users).where(eq(schema.users.username, body.username.trim().toLowerCase())).limit(1);
    return u ?? null;
  }
  if (typeof body.email === "string") {
    const [u] = await d.select().from(schema.users).where(eq(schema.users.email, body.email.trim().toLowerCase())).limit(1);
    return u ?? null;
  }
  return null;
}

function createAuth() {
  const e = env();
  return betterAuth({
    appName: "Arth-QC",
    baseURL: appUrl(),
    secret: e.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db(), {
      provider: "pg",
      schema: {
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verifications,
        rateLimit: schema.authRateLimits,
      },
    }),
    advanced: {
      database: { generateId: () => crypto.randomUUID() },
      useSecureCookies: e.NODE_ENV === "production",
      cookiePrefix: "arthqc",
    },
    trustedOrigins: [appUrl()],
    emailAndPassword: {
      enabled: true,
      // Student PINs are 6+ digits; parent password strength is enforced by our own Zod schema.
      minPasswordLength: 6,
      maxPasswordLength: 128,
      autoSignIn: true,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // refresh daily
      cookieCache: { enabled: true, maxAge: 60 * 5 },
    },
    user: {
      additionalFields: {
        // Never accepted from the client; set server-side only.
        role: { type: "string", required: false, defaultValue: "PARENT", input: false },
      },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      modelName: "rateLimit",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-in/username": { window: 60, max: 5 },
      },
    },
    // Public sign-up is disabled: parents register through /api/auth-flow/register
    // (which also creates the family) and students are created by parents.
    disabledPaths: [
      "/sign-up/email",
      "/update-user",
      "/change-email",
      "/delete-user",
      "/is-username-available",
      "/request-password-reset",
      "/reset-password",
      "/forget-password",
    ],
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (!SIGN_IN_PATHS.has(ctx.path)) return;
        const user = await findLoginUser(ctx.body as Record<string, unknown>);
        if (user?.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
          const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
          throw new APIError("TOO_MANY_REQUESTS", {
            message: `Too many attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`,
            code: "ACCOUNT_LOCKED",
          });
        }
      }),
      after: createAuthMiddleware(async (ctx) => {
        if (!SIGN_IN_PATHS.has(ctx.path)) return;
        const user = await findLoginUser(ctx.body as Record<string, unknown>);
        if (!user) return;
        const d = db();
        const returned = ctx.context.returned;
        if (returned instanceof APIError) {
          const policy = user.role === "STUDENT" ? LOCKOUT.STUDENT : LOCKOUT.PARENT;
          await d
            .update(schema.users)
            .set({
              failedLoginCount: sql`case when ${schema.users.failedLoginCount} + 1 >= ${policy.maxAttempts} then 0 else ${schema.users.failedLoginCount} + 1 end`,
              lockedUntil: sql`case when ${schema.users.failedLoginCount} + 1 >= ${policy.maxAttempts} then now() + (${policy.lockMinutes} * interval '1 minute') else ${schema.users.lockedUntil} end`,
            })
            .where(eq(schema.users.id, user.id));
          return;
        }
        if (ctx.context.newSession) {
          await d
            .update(schema.users)
            .set({ failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() })
            .where(eq(schema.users.id, user.id));
        }
      }),
    },
    plugins: [
      username({
        minUsernameLength: 3,
        maxUsernameLength: 24,
        usernameValidator: (u) => /^[a-z0-9_.]+$/.test(u),
      }),
      nextCookies(),
    ],
  });
}

type Auth = ReturnType<typeof createAuth>;
declare global {
  var __arthAuth: Auth | undefined;
}

export function auth(): Auth {
  if (!globalThis.__arthAuth) globalThis.__arthAuth = createAuth();
  return globalThis.__arthAuth;
}

/** Placeholder address for student accounts (students do not need an email). */
export function studentPlaceholderEmail(usernameValue: string) {
  return `${usernameValue}@students.arth-qc.invalid`;
}
