import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { auth, type OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js';
import type { OAuthClientInformationMixed, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js';
import { NextRequest } from 'next/server';
import { createSessionToken, SESSION_COOKIE } from '../src/lib/auth';
import { GET as discovery } from '../src/app/.well-known/oauth-authorization-server/route';
import { GET as resourceMetadata } from '../src/app/.well-known/oauth-protected-resource/api/mcp/route';
import { GET as authorize, POST as oauthPost } from '../src/app/api/mcp/oauth/[operation]/route';
import { POST as callMcp } from '../src/app/api/mcp/route';

const origin = 'https://lifesystem.oj0nny.com';
const resource = origin + '/api/mcp';
const oauth = resource + '/oauth';
const clientId = 'https://openbot.run/oauth/mcp-client.json';
const redirect = 'http://127.0.0.1:28417/mcp-auth';
const verifier = 'synthetic-pkce-verifier-0123456789-abcdefghijklmnopq';
const challenge = createHash('sha256').update(verifier).digest('base64url');
const syntheticKey = 'synthetic-test-openbot-key-0123456789';
const rpc = { jsonrpc: '2.0', id: 1, method: 'tools/list' };
const requested = {
  response_type: 'code', client_id: clientId, redirect_uri: redirect, resource,
  code_challenge: challenge, code_challenge_method: 'S256', state: 'synthetic-state-1234',
  scope: 'tasks:read captures:read',
};
let session: string;
let dataDir: string;
let previous: Record<string, string | undefined>;

test.beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'lifesystem-oauth-test-'));
  const env = {
    AUTH_USER: 'oauth-test-user', AUTH_PASSWORD: 'oauth-test-password-only',
    MCP_API_KEY: 'qa-legacy-only', MCP_API_KEYS: JSON.stringify([
      { id: 'openbot', key: syntheticKey, scopes: ['tasks:read', 'captures:read', 'tasks:write', 'ai:invoke'] },
    ]),
    LIFESYSTEM_DATA_DIR: dataDir, LIFESYSTEM_STORAGE: 'file',
  };
  previous = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env);
  session = await createSessionToken();
});

test.afterEach(async () => {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  await rm(dataDir, { force: true, recursive: true });
});

function context(operation: string) {
  return { params: Promise.resolve({ operation }) };
}

function form(operation: string, params: Record<string, string>, headers: Record<string, string> = {}) {
  return oauthPost(new NextRequest(oauth + '/' + operation, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers },
    body: new URLSearchParams(params).toString(),
  }), context(operation));
}

function approve(params = requested) {
  return form('authorize', { ...params, decision: 'allow' }, {
    origin, cookie: SESSION_COOKIE + '=' + session,
  });
}

async function consentCode() {
  const response = await approve();
  expect(response.status).toBe(303);
  const callback = new URL(response.headers.get('location')!);
  expect(callback.searchParams.get('state')).toBe(requested.state);
  expect(callback.origin + callback.pathname).toBe(redirect);
  return callback.searchParams.get('code')!;
}

function exchange(code: string, overrides: Record<string, string> = {}) {
  return form('token', {
    grant_type: 'authorization_code', code, code_verifier: verifier,
    redirect_uri: redirect, client_id: clientId, resource, ...overrides,
  });
}

function refresh(refreshToken: string) {
  return form('token', {
    grant_type: 'refresh_token', refresh_token: refreshToken, client_id: clientId, resource,
  });
}

function mcp(token?: string) {
  return callMcp(new NextRequest(resource, {
    method: 'POST', headers: {
      'content-type': 'application/json', accept: 'application/json, text/event-stream',
      ...(token ? { authorization: 'Bearer ' + token } : {}),
    }, body: JSON.stringify(rpc),
  }));
}

test('discovers the pinned OpenBot flow and preserves legacy key access', async () => {
  const unauthorized = await mcp();
  expect(unauthorized.status).toBe(401);
  expect(unauthorized.headers.get('www-authenticate')).toContain('/.well-known/oauth-protected-resource/api/mcp');
  expect(await resourceMetadata().json()).toMatchObject({
    resource, authorization_servers: [origin], scopes_supported: ['tasks:read', 'captures:read'],
  });
  expect(await discovery().json()).toMatchObject({
    issuer: origin, code_challenge_methods_supported: ['S256'], client_id_metadata_document_supported: true,
  });
  expect((await mcp('qa-legacy-only')).status).toBe(200);
});

test('requires the owner session and an explicit, same-origin approval', async () => {
  const authorizeUrl = oauth + '/authorize?' + new URLSearchParams(requested);
  const login = await authorize(new NextRequest(authorizeUrl), context('authorize'));
  expect(new URL(login.headers.get('location')!).searchParams.get('from')).toBe(new URL(authorizeUrl).pathname + new URL(authorizeUrl).search);
  const consent = await authorize(new NextRequest(authorizeUrl, {
    headers: { cookie: SESSION_COOKIE + '=' + session },
  }), context('authorize'));
  expect(consent.status).toBe(200);
  expect(consent.headers.get('cache-control')).toBe('no-store');
  expect(consent.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
  expect(await consent.text()).toContain('Autorizar leitura');
  expect((await form('authorize', { ...requested, decision: 'allow' }, { origin })).status).toBe(401);
  expect((await form('authorize', { ...requested, decision: 'allow' }, {
    origin: 'https://example.org', cookie: SESSION_COOKIE + '=' + session,
  })).status).toBe(403);
  expect((await approve({ ...requested, redirect_uri: 'https://example.org/mcp-auth' })).status).toBe(400);
  expect((await approve({ ...requested, code_challenge_method: 'plain' })).status).toBe(400);
  expect((await approve({ ...requested, scope: 'tasks:write' })).status).toBe(400);
  const denied = await form('authorize', { ...requested, decision: 'deny' }, {
    origin, cookie: SESSION_COOKIE + '=' + session,
  });
  const deniedCallback = new URL(denied.headers.get('location')!);
  expect(deniedCallback.searchParams.get('error')).toBe('access_denied');
  expect(deniedCallback.searchParams.has('code')).toBe(false);
});

test('Chromium submits consent with the LifeSystem origin and receives the callback redirect', async ({ page }) => {
  const endpoint = oauth + '/authorize';
  let submission: { origin: string | undefined; status: number; location: string | null } | undefined;
  await page.route(endpoint + '**', async route => {
    const navigation = route.request();
    const method = navigation.method();
    const headers = await navigation.allHeaders();
    const input = new NextRequest(navigation.url(), {
      method, headers: { ...headers, cookie: SESSION_COOKIE + '=' + session },
      body: navigation.postData() ?? undefined,
    });
    const response = method === 'POST'
      ? await oauthPost(input, context('authorize'))
      : await authorize(input, context('authorize'));
    if (method === 'POST') {
      submission = { origin: headers.origin, status: response.status, location: response.headers.get('location') };
      // Inspect the redirect without sending a synthetic code to a real loopback listener.
      await route.fulfill({ body: 'Envio verificado' });
      return;
    }
    await route.fulfill({
      status: response.status, headers: Object.fromEntries(response.headers), body: await response.text(),
    });
  });
  await page.goto(endpoint + '?' + new URLSearchParams(requested));
  await page.getByRole('button', { name: 'Autorizar leitura' }).click();
  await expect(page.getByText('Envio verificado')).toBeVisible();
  expect(submission).toMatchObject({ origin, status: 303 });
  const callback = new URL(submission!.location!);
  expect(callback.origin + callback.pathname).toBe(redirect);
  expect(callback.searchParams.has('code')).toBe(true);
});

test('binds the single-use code to PKCE, canonical resource and exact callback', async () => {
  const code = await consentCode();
  const invalid: Record<string, string>[] = [
    { code_verifier: 'x'.repeat(43) }, { resource: 'https://example.org/api/mcp' },
    { redirect_uri: 'http://127.0.0.1:28418/mcp-auth' },
  ];
  for (const overrides of invalid) {
    expect((await exchange(code, overrides)).status).toBe(400);
  }
  const results = await Promise.all([exchange(code), exchange(code)]);
  expect(results.map(response => response.status).sort()).toEqual([200, 400]);
  const issued = await results.find(response => response.ok)!.json();
  expect(issued).toMatchObject({ token_type: 'Bearer', scope: 'tasks:read captures:read' });
  const list = await (await mcp(issued.access_token)).json();
  expect(list.result.tools.map((tool: { name: string }) => tool.name).sort()).toEqual(['list_captures', 'list_tasks']);
});

test('rotates refresh and revokes the grant on replay or explicit revocation', async () => {
  const first = await (await exchange(await consentCode())).json();
  const next = await (await refresh(first.refresh_token)).json();
  expect(next.refresh_token).not.toBe(first.refresh_token);
  expect((await mcp(next.access_token)).status).toBe(200);
  expect((await refresh(first.refresh_token)).status).toBe(400);
  expect((await mcp(next.access_token)).status).toBe(401);
  const afterReplay = await (await exchange(await consentCode())).json();
  expect((await form('revoke', { client_id: clientId, token: afterReplay.refresh_token })).status).toBe(200);
  expect((await mcp(afterReplay.access_token)).status).toBe(401);
});

test('removing or rotating the dedicated key disables existing grants', async () => {
  const issued = await (await exchange(await consentCode())).json();
  process.env.MCP_API_KEYS = JSON.stringify([
    { id: 'openbot', key: syntheticKey + '-rotated', scopes: ['tasks:read', 'captures:read'] },
  ]);
  expect((await mcp(issued.access_token)).status).toBe(401);
  expect((await refresh(issued.refresh_token)).status).toBe(400);
  process.env.MCP_API_KEYS = '';
  expect(discovery().status).toBe(404);
  expect((await mcp('qa-legacy-only')).status).toBe(200);
});

test('the MCP OAuth SDK discovers, signs in and renews without a client secret', async () => {
  let client: OAuthClientInformationMixed | undefined;
  let tokens: OAuthTokens | undefined;
  let codeVerifier = '';
  let authorization: URL | undefined;
  const provider: OAuthClientProvider = {
    clientMetadataUrl: clientId,
    redirectUrl: redirect,
    clientMetadata: { redirect_uris: [redirect], token_endpoint_auth_method: 'none' },
    state: () => requested.state,
    clientInformation: () => client,
    saveClientInformation: value => { client = value; },
    tokens: () => tokens,
    saveTokens: value => { tokens = value; },
    redirectToAuthorization: value => { authorization = value; },
    saveCodeVerifier: value => { codeVerifier = value; },
    codeVerifier: () => codeVerifier,
  };
  const fetchFn: typeof fetch = async (input, init) => {
    const target = new URL(String(input));
    if (target.origin !== origin) throw new Error('Unexpected OAuth origin');
    switch (target.pathname) {
      case '/.well-known/oauth-authorization-server': return discovery();
      case '/.well-known/oauth-protected-resource/api/mcp': return resourceMetadata();
      case '/api/mcp/oauth/token': return oauthPost(new NextRequest(target, init as ConstructorParameters<typeof NextRequest>[1]), context('token'));
      default: return new Response(null, { status: 404 });
    }
  };
  const options = { serverUrl: resource, fetchFn };
  expect(await auth(provider, options)).toBe('REDIRECT');
  expect(client?.client_id).toBe(clientId);
  expect(authorization?.searchParams.get('resource')).toBe(resource);
  const consent = await approve(Object.fromEntries(authorization!.searchParams) as typeof requested);
  expect(consent.status).toBe(303);
  const code = new URL(consent.headers.get('location')!).searchParams.get('code')!;
  expect(await auth(provider, { ...options, authorizationCode: code })).toBe('AUTHORIZED');
  expect((await mcp(tokens?.access_token)).status).toBe(200);
  const previousRefresh = tokens?.refresh_token;
  expect(await auth(provider, options)).toBe('AUTHORIZED');
  expect(tokens?.refresh_token).not.toBe(previousRefresh);
  expect((await mcp(tokens?.access_token)).status).toBe(200);
});
