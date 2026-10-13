import { defineConfig } from "@playwright/test";

// E2E runs the built extension (dist/) in Chromium against captured AO3
// fixtures; see e2e/support/extension.ts. Build first: `npm run test:e2e`.
export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    trace: "retain-on-failure",
  },
});
