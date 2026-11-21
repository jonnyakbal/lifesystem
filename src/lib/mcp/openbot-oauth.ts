import { createHash, createHmac, randomBytes } from 'node:crypto';
import { timingSafeStringEqual } from '../auth';
import { storage } from '../storage';
import { parseMcpKeyConfigurations, type McpAuthorization } from './auth';

export const ISSUER = 'https://lifesystem.oj0nny.com';
export const RESOURCE = ISSUER + '/api/mcp';
export const OAUTH_PATH = '/api/mcp/oauth';
export const RESOURCE_METADATA_PATH = '/.well-known/oauth-protected-resource/api/mcp';
export const OPENBOT_CLIENT = 'https://openbot.run/oauth/mcp-client.json';
const COLLECTION = 'mcp_openbot_oauth';
const BASE_SCOPES = ['tasks:read', 'captures:read'];
export const OPENBOT_SCOPE_LABELS: Record<string, string> = {
  'tasks:read': 'Consultar tarefas',
  'captures:read': 'Consultar a caixa de entrada',
  'projects:read': 'Consultar projetos',
  'pillars:read': 'Consultar pilares',
  'indicators:read': 'Consultar indicadores',
  'content:read': 'Consultar conteúdo',
  'content_hub:read': 'Consultar fontes e itens de conteúdo',
  'journal:read': 'Consultar o Diário pessoal',
  'log_entries:read': 'Consultar o Diário de bordo',
  'editais:read': 'Consultar editais',
  'financial:read': 'Consultar lançamentos, contas, cartões, faturas, orçamentos e metas financeiras',
  'calendar:read': 'Consultar o Google Agenda conectado',
  'agenda:read': 'Consultar disponibilidade semanal',
  'weekly_review:read': 'Consultar a última revisão e preparar um rascunho',
  'notes:read': 'Consultar notas e coleções da Wiki',
  'vision:read': 'Consultar documentos de Visão',
  'tasks:write': 'Criar e editar tarefas, planejar blocos e sincronizar blocos vinculados com o Google Agenda',
  'captures:write': 'Criar, classificar e converter capturas para os destinos autorizados',
  'projects:write': 'Criar e editar projetos',
  'pillars:write': 'Editar pilares existentes',
  'indicators:write': 'Criar e atualizar indicadores',
  'content:write': 'Criar e editar conteúdo',
  'content_hub:write': 'Cadastrar e editar fontes e itens de conteúdo',
  'journal:write': 'Registrar e editar entradas do Diário pessoal',
  'log_entries:write': 'Criar e editar registros do Diário de bordo',
  'editais:write': 'Cadastrar e acompanhar editais',
  'financial:write': 'Criar e editar lançamentos, contas, cartões, faturas, orçamentos, credores e metas financeiras',
  'calendar:write': 'Criar e editar eventos do agente. Cancelar eventos gerenciados pelo LifeSystem para o agente',
};
const ACCESS_SECONDS = 15 * 60;
const REFRESH_MS = 30 * 24 * 60 * 60 * 1000;
const CODE_MS = 5 * 60 * 1000;
const MAX_ROTATIONS = 4096;

type Config = { scopes: string[]; defaultScopes: string[]; binding: string };
type Code = { kind: 'code'; digest: string; challenge: string; redirect: string; scopes: string[]; expires: number; binding: string };
type Grant = {
  kind: 'grant'; access: string; refresh: string; spent: string[];
  accessExpires: number; expires: number; scopes: string[]; binding: string;
};
type Entry = Code | Grant;
type TokenResult = { access_token: string; token_type: 'Bearer'; refresh_token: string; expires_in: number; scope: string };

const digest = (value: string) => createHash('sha256').update(value).digest('base64url');
const random = (prefix: string) => prefix + randomBytes(32).toString('base64url');
const isCode = (value: string) => /^lso_c_[\w-]{43}$/.test(value);
const isRefresh = (value: string) => /^lso_r_[\w-]{43}$/.test(value);
const isAccess = (value: string) => /^lso_a_[\w-]{43}$/.test(value);

export function openBotOAuthConfig(): Config | null {
  const owner = process.env.AUTH_USER;
  const password = process.env.AUTH_PASSWORD;
  const keys = parseMcpKeyConfigurations(process.env.MCP_API_KEYS).filter(key => key.id === 'openbot');
  if (!owner || !password || keys.length !== 1) return null;
  const key = keys[0];
  const defaultScopes = BASE_SCOPES.filter(scope => key.scopes.includes(scope));
  if (defaultScopes.length === 0) return null;
  // The direct key stays on its assigned scopes. Only an OAuth consent can issue the broader profile.
  const scopes = defaultScopes.length === BASE_SCOPES.length ? Object.keys(OPENBOT_SCOPE_LABELS) : defaultScopes;
  const binding = createHmac('sha256', key.key)
    .update(JSON.stringify(['lifesystem-openbot-oauth', RESOURCE, owner, password]))
    .digest('base64url');
  return { scopes, defaultScopes, binding };
}

function valid(entry: Entry, config: Config, now: number) {
  return entry.expires > now && entry.binding === config.binding
    && entry.scopes.every(scope => config.scopes.includes(scope));
}

export async function issueOpenBotCode(config: Config, input: { redirect: string; challenge: string; scopes: string[] }) {
  const code = random('lso_c_');
  await storage.transact<Entry, void>(COLLECTION, entries => {
    const now = Date.now();
    const grant = entries.find(entry => entry.kind === 'grant' && valid(entry, config, now));
    entries.splice(0, entries.length, ...(grant ? [grant] : []), {
      kind: 'code', digest: digest(code), expires: now + CODE_MS, binding: config.binding, ...input,
    });
  });
  return code;
}

function issueTokens(scopes: string[], binding: string, now: number, expires: number, spent: string[]) {
  const access = random('lso_a_');
  const refresh = random('lso_r_');
  const accessExpires = Math.min(expires, now + ACCESS_SECONDS * 1000);
  const grant: Grant = {
    kind: 'grant', access: digest(access), refresh: digest(refresh), spent,
    accessExpires, expires, scopes, binding,
  };
  const result: TokenResult = {
    access_token: access, token_type: 'Bearer', refresh_token: refresh,
    expires_in: Math.floor((accessExpires - now) / 1000), scope: scopes.join(' '),
  };
  return { grant, result };
}

export async function exchangeOpenBotCode(config: Config, code: string, verifier: string, redirect: string) {
  if (!isCode(code) || !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return null;
  return storage.transact<Entry, TokenResult | null>(COLLECTION, entries => {
    const now = Date.now();
    const stored = entries.find(entry => entry.kind === 'code');
    if (!stored || !valid(stored, config, now) || stored.digest !== digest(code)
      || stored.redirect !== redirect || !timingSafeStringEqual(stored.challenge, digest(verifier))) return null;
    const { grant, result } = issueTokens(stored.scopes, stored.binding, now, now + REFRESH_MS, []);
    entries.splice(0, entries.length, grant);
    return result;
  });
}

export async function refreshOpenBotGrant(config: Config, refresh: string) {
  if (!isRefresh(refresh)) return null;
  return storage.transact<Entry, TokenResult | null>(COLLECTION, entries => {
    const now = Date.now();
    const index = entries.findIndex(entry => entry.kind === 'grant');
    const stored = entries[index];
    if (!stored || stored.kind !== 'grant' || !valid(stored, config, now)) return null;
    const presented = digest(refresh);
    if (stored.spent.includes(presented)) {
      entries.splice(index, 1);
      return null;
    }
    if (stored.refresh !== presented || stored.spent.length >= MAX_ROTATIONS) return null;
    const { grant, result } = issueTokens(stored.scopes, stored.binding, now, stored.expires, [...stored.spent, presented]);
    entries[index] = grant;
    return result;
  });
}

export async function revokeOpenBotGrant(config: Config, token: string) {
  if (!isAccess(token) && !isRefresh(token)) return;
  const presented = digest(token);
  await storage.transact<Entry, void>(COLLECTION, entries => {
    const index = entries.findIndex(entry => entry.kind === 'grant' && entry.binding === config.binding
      && (entry.access === presented || entry.refresh === presented || entry.spent.includes(presented)));
    if (index >= 0) entries.splice(index, 1);
  });
}

export async function authorizeOpenBotAccess(token: string): Promise<McpAuthorization | null> {
  if (!isAccess(token)) return null;
  const config = openBotOAuthConfig();
  if (!config) return null;
  const presented = digest(token);
  const now = Date.now();
  const entries = await storage.getAll<Entry>(COLLECTION);
  const grant = entries.find(entry => entry.kind === 'grant' && entry.access === presented
    && entry.accessExpires > now && valid(entry, config, now));
  return grant ? { keyId: 'openbot-oauth', scopes: grant.scopes } : null;
}
