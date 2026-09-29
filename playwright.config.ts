import { defineConfig } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
process.env.MESOLOG_E2E_DATA_DIR ||= mkdtempSync(
  path.join(tmpdir(), "mesolog-key-e2e-"),
);
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
      DATA_DIR: process.env.MESOLOG_E2E_DATA_DIR,
      NEXT_BUILD_DIR: ".next-e2e",
      CREDENTIAL_ENCRYPTION_KEY: process.env.CREDENTIAL_ENCRYPTION_KEY,
    },
    timeout: 60000,
  },
});
