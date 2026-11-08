import path from "node:path";
import { defineConfig } from "vitest/config";

// The learner's repository: in the workflow it sits next to this folder.
const learner = path.resolve(process.env.LEARNER ?? path.join(import.meta.dirname, "..", "learner"));

export default defineConfig({
  resolve: { alias: { "@learner": learner } },
  oxc: { jsx: { runtime: "automatic" } },
  server: { fs: { strict: false } },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
