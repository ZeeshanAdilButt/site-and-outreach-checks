import { defineConfig } from "@playwright/test";

const HUMAN_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90000,
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    // A real browser with a normal desktop user agent. The default headless one says HeadlessChrome,
    // which isbot rightly counts as a robot.
    userAgent: HUMAN_UA,
    // CHROME_PATH is for runs on a machine where Playwright's own browser is not installed. CI installs its own.
    launchOptions: { executablePath: process.env.CHROME_PATH || undefined },
  },
});
