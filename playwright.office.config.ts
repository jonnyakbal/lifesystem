import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: /office-(domain|api)\.spec\.ts/,
  workers: 1,
  reporter: "list",
});
