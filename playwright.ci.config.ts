import { defineConfig } from '@playwright/test';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import base from './playwright.config';

// A runner creates this once; its child workers inherit it when loading config.
// External application data, uploads and credentials are never reused.
const runDir = process.env.LIFESYSTEM_PLAYWRIGHT_RUN_DIR || mkdtempSync(join(tmpdir(), 'lifesystem-ci-'));
process.env.LIFESYSTEM_PLAYWRIGHT_RUN_DIR = runDir;
for (const directory of ['data', 'uploads', 'backups', 'cache']) mkdirSync(join(runDir, directory), { recursive: true });
const isolatedEnv = {
  AUTH_USER: 'office-test',
  AUTH_PASSWORD: 'office-ui-test-only',
  MCP_API_KEY: 'qa-synthetic-only',
  MCP_API_KEYS: '',
  HERMES_OFFICE_TOKEN: 'office-test-token-only-12345678901234567890',
  HERMES_OFFICE_INSTALLATION_ID: 'personal',
  GOOGLE_CALENDAR_CLIENT_ID: '',
  GOOGLE_CALENDAR_CLIENT_SECRET: '',
  GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY: '',
  GOOGLE_CALENDAR_REDIRECT_URI: 'http://localhost:3107/api/google-calendar/callback',
  AI_API_KEY: '',
  OPENCODE_API_KEY: '',
  AI_OPENROUTER_API_KEY: '',
  AI_MISTRAL_API_KEY: '',
  AI_GROQ_API_KEY: '',
  NOUS_API_KEY: '',
  LIFESYSTEM_DATA_DIR: join(runDir, 'data'),
  LIFESYSTEM_UPLOAD_DIR: join(runDir, 'uploads'),
  LIFESYSTEM_BACKUP_DIR: join(runDir, 'backups'),
  XDG_CACHE_HOME: join(runDir, 'cache'),
  TZ: 'America/Sao_Paulo',
};
Object.assign(process.env, isolatedEnv);

export default defineConfig({
  ...base,
  forbidOnly: true,
  retries: 0,
  globalSetup: './scripts/playwright-ci-setup.mjs',
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    ...base.use,
    baseURL: 'http://localhost:3107',
    timezoneId: 'America/Sao_Paulo',
    storageState: join(runDir, 'session.json'),
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node node_modules/next/dist/bin/next start --port 3107',
    url: 'http://localhost:3107/login',
    reuseExistingServer: false,
    timeout: 120000,
    env: isolatedEnv,
  },
});
