import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

// This container pre-installs Chromium outside Playwright's registry; use it
// when present so no download is needed. CI installs browsers normally.
const localChromium = "/opt/pw-browsers/chromium";
const executablePath = existsSync(localChromium) ? localChromium : undefined;

export default defineConfig({
  testDir: "e2e",
  // One worker: the /play specs drive a full 3D scene through software GL in
  // CI containers — parallel workers starve each other into timing flakes.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm start",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
