// Uses the Web Crypto API (globalThis.crypto.subtle), not Node's `crypto`
// module — this file is imported by middleware.ts, which runs in the Edge
// runtime by default and cannot load Node built-ins. Web Crypto is
// available in both Edge and Node, so this works in either.

export const SESSION_COOKIE = 'lifesystem_session';

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function timingSafeStringEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(): Promise<string> {
  const secret = process.env.AUTH_PASSWORD || '';
  return hmacHex(secret, 'lifesystem-authenticated');
}

export async function isValidSessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token || !process.env.AUTH_USER || !process.env.AUTH_PASSWORD) return false;
  const expected = await createSessionToken();
  return timingSafeStringEqual(token, expected);
}

export function checkCredentials(user: string, password: string): boolean {
  const expectedUser = process.env.AUTH_USER;
  const expectedPassword = process.env.AUTH_PASSWORD;
  if (!expectedUser || !expectedPassword) return false;
  return timingSafeStringEqual(user, expectedUser) && timingSafeStringEqual(password, expectedPassword);
}
