import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import base from './playwright.config';

// Never reuse a developer's server: its storage could contain personal data.
const dataDir = process.env.LIFESYSTEM_QA_DATA_DIR || mkdtempSync(join(tmpdir(), 'lifesystem-readiness-'));
process.env.LIFESYSTEM_QA_DATA_DIR = dataDir;
process.env.LIFESYSTEM_DATA_DIR = dataDir;
const isolatedEnv = Object.fromEntries([
  'AUTH_USER', 'AUTH_PASSWORD', 'MCP_API_KEYS', 'GOOGLE_CALENDAR_CLIENT_ID',
  'GOOGLE_CALENDAR_CLIENT_SECRET', 'GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY',
  'AI_API_KEY', 'OPENCODE_API_KEY', 'AI_OPENROUTER_API_KEY', 'AI_MISTRAL_API_KEY', 'AI_GROQ_API_KEY', 'NOUS_API_KEY',
].map(key => [key, '']));
const uploadDir = join(dataDir, 'uploads');
Object.assign(process.env, isolatedEnv, { MCP_API_KEY: 'qa-synthetic-only', LIFESYSTEM_UPLOAD_DIR: uploadDir });

const config = {
  ...base,
  retries: 0,
  use: { ...base.use, baseURL: 'http://localhost:3107' },
  webServer: {
    command: 'node node_modules/next/dist/bin/next dev --port 3107',
    url: 'http://localhost:3107',
    reuseExistingServer: false,
    timeout: 120000,
    env: { ...isolatedEnv, LIFESYSTEM_DATA_DIR: dataDir, LIFESYSTEM_UPLOAD_DIR: uploadDir, MCP_API_KEY: 'qa-synthetic-only' },
  },
};
export default config;
