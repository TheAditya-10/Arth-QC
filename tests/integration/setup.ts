import { execSync } from "node:child_process";

/** Runs migrations against TEST_DATABASE_URL before the integration suite. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return;
  execSync("npx drizzle-kit migrate", { env: { ...process.env, DATABASE_URL: url }, stdio: "inherit" });
  execSync("npx tsx --conditions=react-server --tsconfig tsconfig.json scripts/seed.ts", { env: { ...process.env, DATABASE_URL: url, AI_PROVIDER: "mock" }, stdio: "inherit" });
}
