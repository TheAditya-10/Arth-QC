import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src"), "server-only": path.resolve(__dirname, "tests/server-only-stub.ts") } },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    globalSetup: ["tests/integration/setup.ts"],
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
      BETTER_AUTH_SECRET: "integration-test-secret-integration-test-secret",
      AI_PROVIDER: "mock",
      STORAGE_DRIVER: "local",
      NODE_ENV: "test",
    },
    fileParallelism: false,
    testTimeout: 30000,
  },
});
