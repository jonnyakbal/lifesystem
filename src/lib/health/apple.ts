import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { storage } from '@/lib/storage';

// Apple Saúde não tem API na web: os dados saem do iPhone por uma automação do
// app Atalhos (docs/integrations/apple-saude.md), que envia amostras para
// POST /api/health/apple com uma chave própria. A chave é o consentimento:
// criada e revogada pela pessoa em Configurações; aqui só fica o hash.

export const APPLE_ACTOR = 'device:apple-health';
export const APPLE_SOURCE = 'Apple Saúde';
const COLLECTION = 'apple_health_consent';
const ID = 'default';

export type AppleConsent = { id: string; tokenHash: string; createdAt: string; revokedAt: string | null; lastImportAt: string | null; lastImport: ImportResult | null };
export type ImportResult = { created: number; duplicates: number; conflicts: number; invalid: number };
export type AppleConsentStatus = { active: boolean; createdAt: string | null; lastImportAt: string | null; lastImport: ImportResult | null };

const hash = (token: string) => createHash('sha256').update(token).digest();

export async function appleConsentStatus(): Promise<AppleConsentStatus> {
  const consent = await storage.getById<AppleConsent>(COLLECTION, ID);
  const active = Boolean(consent && !consent.revokedAt);
  return { active, createdAt: active ? consent!.createdAt : null, lastImportAt: consent?.lastImportAt ?? null, lastImport: consent?.lastImport ?? null };
}

/** Cria (ou troca) a chave. Ela é mostrada uma única vez; a anterior deixa de valer. */
export async function createAppleToken(): Promise<string> {
  const token = `ls_apple_${randomBytes(32).toString('base64url')}`;
  await storage.transact<AppleConsent, void>(COLLECTION, records => {
    const record: AppleConsent = { id: ID, tokenHash: hash(token).toString('hex'), createdAt: new Date().toISOString(), revokedAt: null, lastImportAt: null, lastImport: null };
    const index = records.findIndex(item => item.id === ID);
    if (index === -1) records.push(record); else records[index] = record;
  });
  return token;
}

export async function revokeAppleToken() {
  await storage.transact<AppleConsent, void>(COLLECTION, records => {
    const record = records.find(item => item.id === ID);
    if (record && !record.revokedAt) record.revokedAt = new Date().toISOString();
  });
}

export async function verifyAppleToken(token: string): Promise<boolean> {
  if (!token.startsWith('ls_apple_') || token.length > 200) return false;
  const consent = await storage.getById<AppleConsent>(COLLECTION, ID);
  if (!consent || consent.revokedAt) return false;
  const expected = Buffer.from(consent.tokenHash, 'hex');
  const received = hash(token);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export async function rememberImport(result: ImportResult) {
  await storage.transact<AppleConsent, void>(COLLECTION, records => {
    const record = records.find(item => item.id === ID);
    if (record) { record.lastImportAt = new Date().toISOString(); record.lastImport = result; }
  });
}

const sampleSchema = z.object({
  type: z.enum(['sleep', 'weight', 'water', 'workout', 'steps']),
  start: z.string().min(10).max(40),
  end: z.string().min(10).max(40).optional(),
  value: z.number().finite().nonnegative().optional(),
  unit: z.string().max(20).optional(),
  name: z.string().max(80).optional(),
});
export const applePayloadSchema = z.object({
  timezone: z.string().min(1).max(80).optional(),
  samples: z.array(sampleSchema).max(5000),
});
export type AppleSample = z.infer<typeof sampleSchema>;

function iso(value: string) { const time = Date.parse(value); return Number.isFinite(time) ? new Date(time).toISOString() : null; }
function key(...parts: (string | number | undefined)[]) {
  return `apple:${createHash('sha256').update(parts.map(part => String(part ?? '')).join('|')).digest('hex').slice(0, 40)}`;
}
function localDay(value: string, timezone: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
}
function kilograms(value: number, unit = 'kg') { return /lb/i.test(unit) ? Math.round(value * 0.45359237 * 10) / 10 : value; }
function milliliters(value: number, unit = 'ml') {
  if (/^l$|litro|liter/i.test(unit)) return Math.round(value * 1000);
  if (/oz/i.test(unit)) return Math.round(value * 29.5735);
  return Math.round(value);
}

/**
 * Converte amostras do Atalhos em observações de saúde com chaves estáveis.
 * Sono chega em pedaços (núcleo, profundo, REM…): pedaços com menos de 60 min de
 * intervalo viram uma noite só. Passos entram somados por dia, e só dias já
 * encerrados — o total de hoje ainda vai mudar.
 */
export function appleObservations(samples: AppleSample[], timezone: string, now = new Date()) {
  const out: { key: string; observation: Record<string, unknown> }[] = [];
  const base = { timezone, sourceRef: APPLE_SOURCE };
  const today = localDay(now.toISOString(), timezone);

  const sleep = samples.flatMap(sample => {
    const start = sample.type === 'sleep' ? iso(sample.start) : null;
    const end = sample.type === 'sleep' && sample.end ? iso(sample.end) : null;
    return start && end && end > start ? [{ start, end }] : [];
  }).sort((a, b) => a.start.localeCompare(b.start));
  const nights: { start: string; end: string }[] = [];
  for (const piece of sleep) {
    const last = nights[nights.length - 1];
    if (last && Date.parse(piece.start) - Date.parse(last.end) < 60 * 60_000) { if (piece.end > last.end) last.end = piece.end; }
    else nights.push({ ...piece });
  }
  for (const night of nights) out.push({ key: key('sleep', night.start, night.end), observation: { ...base, type: 'sleep', observedAt: night.end, startedAt: night.start, endedAt: night.end } });

  const steps = new Map<string, number>();
  for (const sample of samples) {
    const start = iso(sample.start);
    if (!start) continue;
    if (sample.type === 'weight' && sample.value !== undefined) {
      const kg = kilograms(sample.value, sample.unit);
      out.push({ key: key('weight', start, kg), observation: { ...base, type: 'weight', observedAt: start, kg } });
    } else if (sample.type === 'water' && sample.value !== undefined) {
      const ml = milliliters(sample.value, sample.unit);
      if (ml > 0) out.push({ key: key('water', start, ml), observation: { ...base, type: 'water', observedAt: start, ml } });
    } else if (sample.type === 'workout') {
      const end = sample.end ? iso(sample.end) : null;
      const minutes = end ? Math.round((Date.parse(end) - Date.parse(start)) / 60_000) : sample.value !== undefined ? Math.round(sample.value) : undefined;
      const activity = (sample.name || 'Treino').slice(0, 100);
      out.push({ key: key('workout', start, activity), observation: { ...base, type: 'movement', observedAt: end || start, activity, completed: true, ...(minutes && minutes > 0 ? { durationMinutes: minutes } : {}) } });
    } else if (sample.type === 'steps' && sample.value !== undefined) {
      const day = localDay(start, timezone);
      if (day < today) steps.set(day, (steps.get(day) || 0) + sample.value);
    }
  }
  for (const [day, total] of steps) {
    const count = Math.round(total);
    if (count <= 0) continue;
    // Fim do dia local, para cair no dia certo na linha do tempo.
    const observedAt = new Date(Date.parse(`${day}T23:59:00Z`) - offsetMinutes(day, timezone) * 60_000).toISOString();
    out.push({ key: key('steps', day), observation: { ...base, type: 'movement', observedAt, activity: `${count.toLocaleString('pt-BR')} passos`, completed: true } });
  }
  return out;
}

/** Deslocamento do fuso (minutos a leste de UTC) ao meio-dia daquele dia. */
function offsetMinutes(day: string, timezone: string) {
  const noon = new Date(`${day}T12:00:00Z`);
  const local = new Date(noon.toLocaleString('en-US', { timeZone: timezone }));
  const utc = new Date(noon.toLocaleString('en-US', { timeZone: 'UTC' }));
  return Math.round((local.getTime() - utc.getTime()) / 60_000);
}
