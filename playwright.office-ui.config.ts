import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "office-ui.spec.ts",
  workers: 1,
  timeout: 90000,
  use: { baseURL: "http://localhost:4185", ...devices["Desktop Chrome"] },
  webServer: {
    command: "npx next dev --webpack -p 4185",
    url: "http://localhost:4185/login",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      AUTH_USER: "office-test",
      AUTH_PASSWORD: "office-ui-test-only",
      LIFESYSTEM_DATA_DIR: ".office-test-data",
      HERMES_OFFICE_TOKEN: "office-test-token-only-12345678901234567890",
    },
  },
});
