import type { NextRequest } from 'next/server';
import { isValidSessionToken, SESSION_COOKIE } from '../auth';
import { consumeRateLimit, getRateLimitKey } from '../rate-limit';
import {
  exchangeOpenBotCode, ISSUER, issueOpenBotCode, OAUTH_PATH, OPENBOT_CLIENT,
  openBotOAuthConfig, refreshOpenBotGrant, RESOURCE, revokeOpenBotGrant,
} from './openbot-oauth';

const CALLBACK = 'http://127.0.0.1:28417/mcp-auth';
const MAX_INPUT = 8192;
const PRIVATE_HEADERS = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};
const AUTH_FIELDS = [
  'response_type', 'client_id', 'redirect_uri', 'resource', 'code_challenge', 'code_challenge_method', 'state', 'scope',
];
const labels: Record<string, string> = { 'tasks:read': 'Consultar tarefas', 'captures:read': 'Consultar a caixa de entrada' };

export function oauthJson(fields: Record<string, unknown>, status = 200, headers: Record<string, string> = {}) {
  return Response.json(fields, { status, headers: { ...PRIVATE_HEADERS, ...headers } });
}

function error(code: string, status = 400) {
  return oauthJson({ error: code }, status);
}

function redirect(location: URL, status: number) {
  return new Response(null, { status, headers: { ...PRIVATE_HEADERS, Location: location.toString() } });
}

function uniqueParameters(params: URLSearchParams) {
  const input = new Map<string, string>();
  for (const [key, value] of params) {
    if (input.has(key)) return null;
    input.set(key, value);
  }
  return input;
}

async function readForm(request: Request) {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
  if (contentType !== 'application/x-www-form-urlencoded' || !request.body) return null;
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_INPUT) {
        await reader.cancel();
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
    return uniqueParameters(new URLSearchParams(text + decoder.decode()));
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

function parseAuthorization(input: Map<string, string>, allowed: string[]) {
  const callback = input.get('redirect_uri');
  const challenge = input.get('code_challenge');
  const state = input.get('state');
  if (input.get('client_id') !== OPENBOT_CLIENT || callback !== CALLBACK
    || input.get('response_type') !== 'code' || input.get('resource') !== RESOURCE
    || input.get('code_challenge_method') !== 'S256' || !challenge || !/^[\w-]{43}$/.test(challenge)
    || !state || state.length > 512 || /[\x00-\x1f\x7f]/.test(state)) return null;
  const scope = input.get('scope');
  const scopes = scope === undefined ? allowed : [...new Set(scope.trim().split(/ +/))];
  if (!scopes.every(item => allowed.includes(item))) return null;
  return { callback, challenge, state, scopes };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}

function consentPage(input: Map<string, string>, scopes: string[]) {
  const hidden = AUTH_FIELDS.flatMap(name => {
    const value = input.get(name);
    return value === undefined ? [] : [`<input type="hidden" name="${name}" value="${escapeHtml(value)}">`];
  }).join('');
  const list = scopes.map(scope => `<li>${labels[scope]}</li>`).join('');
  const html = `<!doctype html>
<html lang="pt-BR">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Conectar OpenBot ao LifeSystem</title>
<style>
  :root{color-scheme:dark;background:#0b111a;color:#eef6ff;font:16px/1.55 system-ui}
  body{margin:0;padding:24px;min-height:90vh;display:grid;place-items:center;box-sizing:border-box}
  main{width:min(100%,480px);padding:32px;box-sizing:border-box;border:1px solid #364759;border-radius:18px;background:#141d29}
  h1{font-size:1.75rem;line-height:1.2;margin:8px 0 16px} p{color:#becee0} ul{padding-left:20px}
  form{display:flex;flex-wrap:wrap;gap:12px;margin-top:24px} button{cursor:pointer;border:1px solid #576b82;border-radius:8px;background:#192636;color:inherit;padding:10px 15px;font:inherit}
  button:first-of-type{background:#75def2;color:#102434;border-color:#75def2;font-weight:650}
  button:focus-visible{outline:2px solid #fff;outline-offset:4px}
</style>
<main>
  <small>LIFESYSTEM</small>
  <h1>Conectar OpenBot</h1>
  <p>Permita que o Agente Pessoal consulte os itens abaixo. Confirme somente se você iniciou a conexão no OpenBot.</p>
  <ul>${list}</ul>
  <form method="post" action="${OAUTH_PATH}/authorize">
    ${hidden}
    <button name="decision" value="allow">Autorizar leitura</button>
    <button name="decision" value="deny">Cancelar</button>
  </form>
</main>
</html>`;
  return new Response(html, { headers: {
    ...PRIVATE_HEADERS, 'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': `default-src 'none'; style-src 'unsafe-inline'; form-action 'self' ${CALLBACK}; frame-ancestors 'none'; base-uri 'none'`,
  } });
}

async function isOwner(request: NextRequest) {
  return isValidSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
}

export async function openBotAuthorizationPage(request: NextRequest) {
  const config = openBotOAuthConfig();
  if (!config) return error('not_found', 404);
  const input = request.nextUrl.search.length <= MAX_INPUT && uniqueParameters(request.nextUrl.searchParams);
  if (!input) return error('invalid_request');
  const authorization = parseAuthorization(input, config.scopes);
  if (!authorization) return error('invalid_request');
  if (!await isOwner(request)) {
    const login = new URL('/login', ISSUER);
    login.searchParams.set('from', OAUTH_PATH + '/authorize' + request.nextUrl.search);
    return redirect(login, 303);
  }
  return consentPage(input, authorization.scopes);
}

export async function openBotOAuthPost(request: NextRequest, operation: string) {
  if (!['authorize', 'token', 'revoke'].includes(operation)) return error('not_found', 404);
  const config = openBotOAuthConfig();
  if (!config) return error(operation === 'token' ? 'invalid_grant' : 'not_found', operation === 'token' ? 400 : 404);
  const baseLimit = consumeRateLimit(getRateLimitKey(request, 'openbot-oauth:' + operation), 30, 60_000);
  if (!baseLimit.allowed) return oauthJson({ error: 'temporarily_unavailable' }, 429, { 'Retry-After': String(baseLimit.retryAfterSeconds) });
  const serviceLimit = consumeRateLimit('openbot-oauth-global:' + operation, 90, 60_000);
  if (!serviceLimit.allowed) return oauthJson({ error: 'temporarily_unavailable' }, 429, { 'Retry-After': String(serviceLimit.retryAfterSeconds) });

  const input = await readForm(request);
  if (!input) return error('invalid_request');
  if (operation === 'authorize') {
    if (request.headers.get('origin') !== ISSUER) return error('access_denied', 403);
    if (!await isOwner(request)) return error('access_denied', 401);
    const parsed = parseAuthorization(input, config.scopes);
    const decision = input.get('decision');
    if (!parsed || (decision !== 'allow' && decision !== 'deny')) return error('invalid_request');
    const callback = new URL(parsed.callback);
    callback.searchParams.set('state', parsed.state);
    if (decision === 'deny') {
      callback.searchParams.set('error', 'access_denied');
    } else {
      const code = await issueOpenBotCode(config, { redirect: parsed.callback, challenge: parsed.challenge, scopes: parsed.scopes });
      callback.searchParams.set('code', code);
    }
    return redirect(callback, 303);
  }

  if (input.get('client_id') !== OPENBOT_CLIENT || request.headers.has('authorization')) return error('invalid_client');
  if (operation === 'revoke') {
    const token = input.get('token');
    if (!token) return error('invalid_request');
    await revokeOpenBotGrant(config, token);
    return new Response(null, { headers: PRIVATE_HEADERS });
  }
  if (input.get('resource') !== RESOURCE) return error('invalid_target');
  const grant = input.get('grant_type');
  if (grant === 'authorization_code') {
    const result = await exchangeOpenBotCode(config, input.get('code') ?? '', input.get('code_verifier') ?? '', input.get('redirect_uri') ?? '');
    return result ? oauthJson(result) : error('invalid_grant');
  }
  if (grant === 'refresh_token') {
    // Refresh can only renew the scope that the owner already approved.
    if (input.has('scope')) return error('invalid_scope');
    const result = await refreshOpenBotGrant(config, input.get('refresh_token') ?? '');
    return result ? oauthJson(result) : error('invalid_grant');
  }
  return error('unsupported_grant_type');
}
