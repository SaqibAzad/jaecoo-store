import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    // Integration tests share one Postgres database, so they must not run
    // concurrently with each other.
    fileParallelism: false,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
      exclude: ["src/lib/db.ts"],
    },
  },
  resolve: { alias: { "@": resolve(import.meta.dirname, "src") } },
});
