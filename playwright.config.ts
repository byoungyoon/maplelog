import { defineConfig } from "@playwright/test";
import { randomBytes } from "node:crypto";
process.env.CREDENTIAL_ENCRYPTION_KEY ||= randomBytes(32).toString("hex");
const baseURL = "http://127.0.0.1:3100";
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: {
    baseURL,
    channel: "chrome",
    headless: true,
    trace: "off",
    screenshot: "off",
  },
  reporter: [["list"]],
  outputDir: "test-results",
  webServer: {
    command: "npm run dev -- --port 3100",
    url: baseURL,
    reuseExistingServer: false,
    env: {
      FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || "demo-maplelog",
      FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080",
      NEXT_BUILD_DIR: ".next-e2e",
      CREDENTIAL_ENCRYPTION_KEY: process.env.CREDENTIAL_ENCRYPTION_KEY,
    },
    timeout: 60000,
  },
});
