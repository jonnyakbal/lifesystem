import { request } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

// Authenticate through the public API; never bypass the production auth gate.
export default async function setup(config) {
  const { baseURL, storageState } = config.projects[0].use;
  const api = await request.newContext({ baseURL });
  try {
    const unauthenticated = await api.get('/api/tasks');
    if (unauthenticated.status() !== 401) throw new Error(`Protected API must return 401 before login; received ${unauthenticated.status()}`);
    const login = await api.post('/api/login', { data: { user: process.env.AUTH_USER, password: process.env.AUTH_PASSWORD } });
    if (!login.ok()) throw new Error(`Synthetic login failed: ${login.status()}`);
    const authenticated = await api.get('/api/tasks');
    if (!authenticated.ok()) throw new Error(`Protected API rejected synthetic session: ${authenticated.status()}`);
    await mkdir(dirname(storageState), { recursive: true });
    await api.storageState({ path: storageState });
  } finally {
    await api.dispose();
  }
}
