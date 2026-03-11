import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: [
      "src/**/*.test.ts",
      "src/**/*.integration.test.ts",
    ],
    testTimeout: 10_000,
    env: {
      NODE_ENV: "test",
    },
  },
});
