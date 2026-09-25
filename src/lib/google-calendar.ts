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
  const response = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${await accessToken()}` },
    cache: 'no-store',
  });
  if (!response.ok) throw new GoogleCalendarError(response.status === 401 ? 'A conexão com o Google Agenda expirou. Conecte novamente.' : 'Não foi possível consultar o Google Agenda.');
  const data = await response.json() as { items?: Array<{
    id?: string; summary?: string; status?: string; htmlLink?: string;
    start?: { date?: string; dateTime?: string }; end?: { date?: string; dateTime?: string };
  }> };
  return (data.items || []).filter(item => item.status !== 'cancelled' && item.id && (item.start?.dateTime || item.start?.date) && (item.end?.dateTime || item.end?.date))
    .map(item => ({
      id: item.id!, title: item.summary?.trim() || 'Ocupado',
      start: item.start!.dateTime || item.start!.date!,
      end: item.end!.dateTime || item.end!.date!,
      allDay: Boolean(item.start!.date),
      url: item.htmlLink?.startsWith('https://') ? item.htmlLink : undefined,
    }));
}

export function signGoogleState(nonce: string) { return createHash('sha256').update(`${required('GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY')}:${nonce}`).digest('base64url'); }
