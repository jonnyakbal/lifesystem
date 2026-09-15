import { test, expect } from '@playwright/test';

function uniqueTestAddress() {
  return `198.51.100.${Math.floor(Math.random() * 200) + 1}`;
}

test.describe('API rate limits', () => {
  test('login blocks repeated attempts and returns Retry-After', async ({ request }) => {
    const address = uniqueTestAddress();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await request.post('/api/login', {
        headers: { 'x-forwarded-for': address },
        data: { user: 'invalid-user', password: 'invalid-password' },
      });
      expect(response.status()).toBe(401);
    }

    const blocked = await request.post('/api/login', {
      headers: { 'x-forwarded-for': address },
      data: { user: 'invalid-user', password: 'invalid-password' },
    });
    expect(blocked.status()).toBe(429);
    expect(Number(blocked.headers()['retry-after'])).toBeGreaterThan(0);
  });

  test('MCP throttles unauthenticated request bursts', async ({ request }) => {
    const address = uniqueTestAddress();
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const response = await request.post('/api/mcp', {
        headers: { 'x-forwarded-for': address, authorization: 'Bearer invalid-test-token' },
        data: {},
      });
      expect(response.status()).toBe(401);
    }

    const blocked = await request.post('/api/mcp', {
      headers: { 'x-forwarded-for': address, authorization: 'Bearer invalid-test-token' },
      data: {},
    });
    expect(blocked.status()).toBe(429);
    expect(Number(blocked.headers()['retry-after'])).toBeGreaterThan(0);
  });
});
