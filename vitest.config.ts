import path from "node:path";

import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      miniflare: {
        // Secrets aren't in wrangler.jsonc; provide them for tests. The
        // `TOKENS` KV + `REDDIT_USER_AGENT` var come from the config.
        bindings: {
          REDDIT_CLIENT_ID: "test-client-id",
          REDDIT_CLIENT_SECRET: "test-client-secret",
        },
      },
      wrangler: {
        configPath: "./wrangler.jsonc",
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "__tests__"),
      "~": path.resolve(__dirname, "src"),
    },
  },
  test: {
    include: ["__tests__/**/*.test.ts"],
    name: "@workers/ryddit",
    setupFiles: ["__tests__/setup.ts"],
  },
});
