import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { storage } from './storage';

const TOKEN_COLLECTION = 'google-calendar';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

type TokenRecord = { id: string; payload: string; expiry: number; createdAt: string; updatedAt: string };
type GoogleToken = { access_token: string; refresh_token?: string; expires_in?: number; token_type?: string };

export class GoogleCalendarError extends Error {}

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new GoogleCalendarError(`Configure ${name} para conectar o Google Agenda.`);
  return value;
}

function encryptionKey() {
  const raw = required('GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY');
  if (!/^[a-f0-9]{64}$/i.test(raw)) throw new GoogleCalendarError('GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY precisa ter 64 caracteres hexadecimais.');
  return Buffer.from(raw, 'hex');
}

function encrypt(value: string) {
  const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64url');
}

function decrypt(value: string) {
  const data = Buffer.from(value, 'base64url'); const iv = data.subarray(0, 12); const tag = data.subarray(12, 28); const ciphertext = data.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv); decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

export function googleCalendarConfigured() {
  return Boolean(process.env.GOOGLE_CALENDAR_CLIENT_ID && process.env.GOOGLE_CALENDAR_CLIENT_SECRET && process.env.GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY);
}

export async function getGoogleCalendarConnectionStatus() {
  const configured = googleCalendarConfigured();
  return { configured, connected: configured && Boolean(await tokenRecord()) };
}

export function buildGoogleAuthorizationUrl(redirectUri: string, state: string) {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({ client_id: required('GOOGLE_CALENDAR_CLIENT_ID'), redirect_uri: redirectUri, response_type: 'code', scope: 'https://www.googleapis.com/auth/calendar.events', access_type: 'offline', prompt: 'consent', state }).toString();
  return url.toString();
}

async function tokenRecord() {
  const records = await storage.getAll<TokenRecord>(TOKEN_COLLECTION);
  return records.reduce<TokenRecord | null>((latest, record) =>
    !latest || record.updatedAt > latest.updatedAt ? record : latest, null);
}

async function saveToken(token: GoogleToken) {
  const previous = await tokenRecord();
  const payload = encrypt(JSON.stringify({ ...token, refresh_token: token.refresh_token || (previous ? JSON.parse(decrypt(previous.payload)).refresh_token : undefined) }));
  const record = { payload, expiry: Date.now() + Math.max(60, token.expires_in || 3600) * 1000 - 30_000 };
  if (previous) await storage.update<TokenRecord>(TOKEN_COLLECTION, previous.id, record);
  else await storage.create<TokenRecord>(TOKEN_COLLECTION, record);
}

export async function exchangeGoogleCode(code: string, redirectUri: string) {
  const body = new URLSearchParams({ code, client_id: required('GOOGLE_CALENDAR_CLIENT_ID'), client_secret: required('GOOGLE_CALENDAR_CLIENT_SECRET'), redirect_uri: redirectUri, grant_type: 'authorization_code' });
  const response = await fetch(GOOGLE_TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  if (!response.ok) throw new GoogleCalendarError('O Google recusou a conexão. Tente conectar novamente.');
  await saveToken(await response.json() as GoogleToken);
}

async function accessToken() {
  const record = await tokenRecord();
  if (!record) throw new GoogleCalendarError('Conecte o Google Agenda antes de criar eventos.');
  const token = JSON.parse(decrypt(record.payload)) as GoogleToken;
  if (record.expiry > Date.now()) return token.access_token;
  if (!token.refresh_token) throw new GoogleCalendarError('A conexão com o Google Agenda expirou. Conecte novamente.');
  const body = new URLSearchParams({ refresh_token: token.refresh_token, client_id: required('GOOGLE_CALENDAR_CLIENT_ID'), client_secret: required('GOOGLE_CALENDAR_CLIENT_SECRET'), grant_type: 'refresh_token' });
  const response = await fetch(GOOGLE_TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  if (!response.ok) throw new GoogleCalendarError('Não foi possível renovar a conexão com o Google Agenda.');
  const refreshed = await response.json() as GoogleToken; await saveToken({ ...refreshed, refresh_token: token.refresh_token });
  return refreshed.access_token;
}

export async function createGoogleCalendarEvent(input: { title: string; description?: string; start: string; end: string; timeZone?: string }) {
  const start = new Date(input.start); const end = new Date(input.end);
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf()) || end <= start) throw new GoogleCalendarError('Informe início e fim válidos para o evento.');
  const response = await fetch(GOOGLE_EVENTS_URL, { method: 'POST', headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ summary: input.title, description: input.description || '', start: { dateTime: start.toISOString(), timeZone: input.timeZone || 'America/Sao_Paulo' }, end: { dateTime: end.toISOString(), timeZone: input.timeZone || 'America/Sao_Paulo' } }) });
  if (!response.ok) throw new GoogleCalendarError('O Google Agenda não criou o evento. A captura foi mantida sem alterações.');
  const event = await response.json() as { id: string; htmlLink?: string };
  return { id: event.id, url: event.htmlLink };
}

export interface GoogleCalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  busy?: boolean;
  url?: string;
}

export async function listGoogleCalendarEvents(from: string, to: string): Promise<GoogleCalendarEvent[]> {
  const start = new Date(from);
  const end = new Date(to);
  const range = end.getTime() - start.getTime();
  if (!Number.isFinite(range) || range <= 0 || range > 31 * 86400000) {
    throw new GoogleCalendarError('Informe um intervalo válido de até 31 dias.');
  }
  const url = new URL(GOOGLE_EVENTS_URL);
  url.search = new URLSearchParams({
    timeMin: start.toISOString(), timeMax: end.toISOString(),
    singleEvents: 'true', orderBy: 'startTime', maxResults: '250',
  }).toString();
  const token = await accessToken();
  const events: GoogleCalendarEvent[] = [];
  const pages = new Set<string>();
  do {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new GoogleCalendarError(response.status === 401 ? 'A conexão com o Google Agenda expirou. Conecte novamente.' : 'Não foi possível consultar o Google Agenda.');
    const data = await response.json() as { nextPageToken?: string; items?: Array<{
      id?: string; summary?: string; status?: string; htmlLink?: string; transparency?: string;
      start?: { date?: string; dateTime?: string }; end?: { date?: string; dateTime?: string };
    }> };
    events.push(...(data.items || []).filter(item => item.status !== 'cancelled' && item.id && (item.start?.dateTime || item.start?.date) && (item.end?.dateTime || item.end?.date))
      .map(item => ({
        id: item.id!, title: item.summary?.trim() || 'Ocupado',
        start: item.start!.dateTime || item.start!.date!,
        end: item.end!.dateTime || item.end!.date!,
        allDay: Boolean(item.start!.date),
        ...(item.transparency === 'transparent' ? { busy: false } : {}),
        url: item.htmlLink?.startsWith('https://') ? item.htmlLink : undefined,
      })));
    if (!data.nextPageToken) return events;
    if (pages.has(data.nextPageToken) || pages.size >= 20) throw new GoogleCalendarError('A agenda não pôde ser carregada por completo. Tente novamente.');
    pages.add(data.nextPageToken);
    url.searchParams.set('pageToken', data.nextPageToken);
  } while (true);
}

export function signGoogleState(nonce: string) { return createHash('sha256').update(`${required('GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY')}:${nonce}`).digest('base64url'); }

type ManagedEvent = {
  id: string; etag: string; htmlLink?: string; status?: string; summary?: string; description?: string;
  start?: { dateTime?: string }; end?: { dateTime?: string };
  extendedProperties?: { private?: { lifesystemTaskId?: string } };
};

async function managedRequest(eventId: string, options?: RequestInit) {
  return fetch(`${GOOGLE_EVENTS_URL}/${encodeURIComponent(eventId)}`, {
    ...options, cache: 'no-store', signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json', ...options?.headers },
  });
}

function assertManaged(event: ManagedEvent, taskId: string) {
  if (event.status === 'cancelled') throw new GoogleCalendarError('O evento foi removido no Google. Revise a agenda antes de sincronizar.');
  if (event.extendedProperties?.private?.lifesystemTaskId !== taskId) throw new GoogleCalendarError('O evento não pertence a esta tarefa. A agenda não foi alterada.');
}

export async function syncManagedTaskEvent(input: { taskId: string; eventId: string; etag?: string; title: string; startAt: string; endAt: string; timeZone: string; lastAttempt?: { title: string; startAt: string; endAt: string; description: string | null }; beforeWrite?: (description: string | null) => Promise<void> }) {
  const origin = new URL(process.env.GOOGLE_CALENDAR_REDIRECT_URI || 'https://lifesystem.oj0nny.com/api/google-calendar/callback').origin;
  const body = {
    summary: input.title,
    description: `Bloco de trabalho · LIFESYSTEM\n${origin}/tarefas?open=${encodeURIComponent(input.taskId)}\nLIFESYSTEM task:${input.taskId}`,
    start: { dateTime: input.startAt, timeZone: input.timeZone },
    end: { dateTime: input.endAt, timeZone: input.timeZone },
    extendedProperties: { private: { lifesystemTaskId: input.taskId } },
  };
  const current = await managedRequest(input.eventId);
  let response: Response;
  if (current.ok) {
    const event = await current.json() as ManagedEvent;
    assertManaged(event, input.taskId);
    // A lost acknowledgement can be retried without another insert or PATCH.
    if (event.summary === body.summary &&
      new Date(event.start?.dateTime || '').getTime() === new Date(input.startAt).getTime() &&
      new Date(event.end?.dateTime || '').getTime() === new Date(input.endAt).getTime()) return event;
    const acknowledgedAttempt = input.lastAttempt && event.summary === input.lastAttempt.title && (event.description ?? null) === input.lastAttempt.description &&
      Date.parse(event.start?.dateTime || '') === Date.parse(input.lastAttempt.startAt) && Date.parse(event.end?.dateTime || '') === Date.parse(input.lastAttempt.endAt);
    if ((!input.etag || input.etag !== event.etag) && !acknowledgedAttempt) throw new GoogleCalendarError('O evento mudou no Google. Abra a agenda para revisar; nenhuma alteração externa foi sobrescrita.');
    await input.beforeWrite?.(event.description ?? null);
    response = await managedRequest(input.eventId, { method: 'PATCH', headers: { 'If-Match': event.etag }, body: JSON.stringify({ ...body, description: event.description }) });
  } else if (current.status === 404 && !input.etag) {
    await input.beforeWrite?.(body.description);
    response = await fetch(GOOGLE_EVENTS_URL, {
      method: 'POST', signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: input.eventId, ...body }),
    });
    if (response.status === 409) throw new GoogleCalendarError('O evento já existe. Tente sincronizar novamente para recuperar o vínculo.');
  } else if (current.status === 404 || current.status === 410) {
    throw new GoogleCalendarError('O evento foi removido no Google. Seu bloco local foi preservado.');
  } else throw new GoogleCalendarError('Não foi possível consultar o Google. Reconecte a agenda ou tente novamente.');
  if (!response.ok) throw new GoogleCalendarError(response.status === 412 ? 'O evento mudou no Google durante a gravação. Revise a agenda.' : 'Não foi possível salvar no Google. Seu bloco local foi preservado; tente novamente.');
  return await response.json() as ManagedEvent;
}

export async function readManagedTaskEvent(taskId: string, eventId: string) {
  const response = await managedRequest(eventId);
  if (!response.ok) throw new GoogleCalendarError('Não foi possível ler o evento. Verifique a conexão com o Google.');
  const event = await response.json() as ManagedEvent;
  assertManaged(event, taskId);
  return event;
}

export async function deleteManagedTaskEvent(taskId: string, eventId: string, etag?: string) {
  const current = await managedRequest(eventId);
  if (current.status === 404 || current.status === 410) return;
  if (!current.ok) throw new GoogleCalendarError('Não foi possível consultar o evento. O bloco foi mantido.');
  const event = await current.json() as ManagedEvent;
  if (event.status === 'cancelled') return;
  assertManaged(event, taskId);
  if (!etag || etag !== event.etag) throw new GoogleCalendarError('O evento mudou no Google. Revise a agenda antes de remover o bloco.');
  const response = await managedRequest(eventId, { method: 'DELETE', headers: { 'If-Match': etag } });
  if (!response.ok && response.status !== 410 && response.status !== 404) throw new GoogleCalendarError('Não foi possível remover o evento. O bloco foi mantido.');
}
