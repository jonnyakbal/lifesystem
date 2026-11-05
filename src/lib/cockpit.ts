import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { storage } from '@/lib/storage';
import { getLatestMcpHeartbeat } from '@/lib/mcp/heartbeat';
import type { McpCallLog } from '@/lib/mcp/log';
import type { LogEntry } from '@/types';

// Sinais reais para o cockpit do Diário de bordo (inspirado na Central de comando
// do ArcoPass). Sinal sem fonte vira "desconhecido", nunca "ok": a hospedagem
// compartilhada não expõe CPU/memória, então os medidores usam o que existe.

export type Estado = 'ok' | 'atencao' | 'alerta' | 'desconhecido';
export type Sinal = { estado: Estado; resumo: string; em: string | null; valor: number | null; url?: string };
export type CockpitSignals = { verificadoEm: string; ci: Sinal; hermes: Sinal; mcpLatencia: Sinal; backup: Sinal; dados: Sinal; seguranca: Sinal; diario: Sinal };

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const unknown = (resumo: string): Sinal => ({ estado: 'desconhecido', resumo, em: null, valor: null });

let ciCache: { at: number; value: Sinal } | null = null;
/** Último CI da main no GitHub (repositório público). Cache de 5 min; sem rede = desconhecido. */
async function ciSignal(): Promise<Sinal> {
  if (process.env.LIFESYSTEM_COCKPIT_CI === 'off') return unknown('Consulta ao GitHub desligada neste ambiente.');
  if (ciCache && Date.now() - ciCache.at < 5 * 60_000) return ciCache.value;
  const repo = process.env.LIFESYSTEM_GITHUB_REPO || 'jonnyakbal/lifesystem';
  try {
    const response = await fetch(`https://api.github.com/repos/${repo}/actions/runs?branch=main&per_page=1`, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'lifesystem-cockpit' }, signal: AbortSignal.timeout(3000), cache: 'no-store' });
    if (!response.ok) return unknown(`GitHub respondeu ${response.status}.`);
    const run = ((await response.json()) as { workflow_runs?: { head_sha: string; status: string; conclusion: string | null; html_url: string; updated_at: string }[] }).workflow_runs?.[0];
    if (!run) return unknown('Nenhuma execução de CI encontrada.');
    const sha = run.head_sha.slice(0, 7);
    const value: Sinal = run.status !== 'completed'
      ? { estado: 'atencao', resumo: `CI rodando em ${sha}`, em: run.updated_at, valor: null, url: run.html_url }
      : run.conclusion === 'success'
        ? { estado: 'ok', resumo: `CI verde em ${sha}`, em: run.updated_at, valor: null, url: run.html_url }
        : { estado: 'alerta', resumo: `CI ${run.conclusion === 'failure' ? 'falhou' : run.conclusion} em ${sha}`, em: run.updated_at, valor: null, url: run.html_url };
    ciCache = { at: Date.now(), value };
    return value;
  } catch { return unknown('Sem resposta do GitHub.'); }
}

async function hermesSignals(): Promise<{ hermes: Sinal; mcpLatencia: Sinal }> {
  let hermes = unknown('Hermes nunca enviou sinal.');
  try {
    const beat = await getLatestMcpHeartbeat();
    if (beat) {
      const minutes = Math.round((Date.now() - Date.parse(beat.lastSeenAt)) / 60_000);
      // O Hermes envia sinal a cada 5 min.
      const estado: Estado = beat.status === 'degraded' ? 'atencao' : minutes <= 15 ? 'ok' : minutes <= 60 ? 'atencao' : 'alerta';
      hermes = { estado, resumo: beat.status === 'degraded' ? 'Hermes avisou que está degradado' : minutes <= 15 ? 'Hermes online' : `Hermes sem sinal há ${minutes} min`, em: beat.lastSeenAt, valor: minutes };
    }
  } catch { hermes = unknown('Não foi possível ler o sinal do Hermes.'); }
  let mcpLatencia = unknown('Nenhuma chamada MCP registrada.');
  try {
    const logs = (await storage.getAll<McpCallLog>('mcp-logs')).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20);
    const durations = logs.map(log => log.durationMs).filter((value): value is number => typeof value === 'number').sort((a, b) => a - b);
    const failures = logs.filter(log => !log.success).length;
    if (durations.length) {
      const median = durations[Math.floor(durations.length / 2)];
      const estado: Estado = failures >= 5 ? 'alerta' : failures > 0 || median > 2000 ? 'atencao' : 'ok';
      mcpLatencia = { estado, resumo: `${median} ms (mediana das últimas ${durations.length}) · ${failures} falha${failures === 1 ? '' : 's'}`, em: logs[0]?.createdAt ?? null, valor: median };
    }
  } catch { mcpLatencia = unknown('Auditoria MCP indisponível.'); }
  return { hermes, mcpLatencia };
}

function dataDir() { return path.resolve(process.env.LIFESYSTEM_DATA_DIR || 'data'); }
function backupDir() {
  const source = dataDir();
  return path.resolve(process.env.LIFESYSTEM_BACKUP_DIR || (process.env.LIFESYSTEM_DATA_DIR ? path.join(path.dirname(source), 'lifesystem-backups') : 'data/backups'));
}

/** Backup mais recente com manifesto (gerado a cada publicação). */
async function backupSignal(): Promise<Sinal> {
  try {
    const root = backupDir();
    const folders = (await readdir(root, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name).sort().reverse();
    for (const folder of folders) {
      try {
        const manifest = JSON.parse(await readFile(path.join(root, folder, 'manifest.json'), 'utf8')) as { createdAt: string; files: { size: number }[]; consistency?: string };
        const hours = Math.round((Date.now() - Date.parse(manifest.createdAt)) / HOUR);
        const estado: Estado = hours <= 72 ? 'ok' : hours <= 14 * 24 ? 'atencao' : 'alerta';
        const size = manifest.files.reduce((sum, file) => sum + file.size, 0);
        return { estado, resumo: `${manifest.files.length} arquivos · ${(size / 1_048_576).toFixed(1)} MB${manifest.consistency && manifest.consistency !== 'verified-unchanged' ? ' · cópia com escrita em andamento' : ''}`, em: manifest.createdAt, valor: hours };
      } catch { /* pasta sem manifesto: tenta a anterior */ }
    }
    return unknown('Nenhum backup com manifesto encontrado.');
  } catch { return unknown('Pasta de backups indisponível neste servidor.'); }
}

/** Tamanho dos dados em arquivo (no D1 o tamanho por arquivo não existe). */
async function dataSignal(): Promise<Sinal> {
  if (process.env.LIFESYSTEM_STORAGE === 'd1') return unknown('Dados no Cloudflare D1: tamanho não medido por aqui.');
  try {
    const dir = dataDir();
    const names = (await readdir(dir)).filter(name => name.endsWith('.json'));
    const sizes = await Promise.all(names.map(async name => (await stat(path.join(dir, name))).size));
    const total = sizes.reduce((sum, size) => sum + size, 0);
    const mb = total / 1_048_576;
    return { estado: mb < 200 ? 'ok' : mb < 500 ? 'atencao' : 'alerta', resumo: `${mb.toFixed(1)} MB em ${names.length} coleções`, em: null, valor: Math.round(mb * 10) / 10 };
  } catch { return unknown('Pasta de dados indisponível.'); }
}

function logSignals(entries: LogEntry[]): { seguranca: Sinal; diario: Sinal } {
  const days = (date: string) => Math.max(0, Math.floor((Date.now() - Date.parse(`${date}T12:00:00`)) / DAY));
  const latest = [...entries].sort((a, b) => b.date.localeCompare(a.date))[0];
  const security = entries.filter(entry => entry.category === 'seguranca').sort((a, b) => b.date.localeCompare(a.date))[0];
  const diario: Sinal = latest
    ? { estado: days(latest.date) <= 7 ? 'ok' : days(latest.date) <= 21 ? 'atencao' : 'alerta', resumo: `Última entrada há ${days(latest.date)} d: ${latest.title}`, em: latest.date, valor: days(latest.date) }
    : { estado: 'alerta', resumo: 'Diário vazio.', em: null, valor: null };
  const seguranca: Sinal = security
    ? { estado: days(security.date) <= 30 ? 'ok' : days(security.date) <= 90 ? 'atencao' : 'alerta', resumo: `Última revisão de segurança há ${days(security.date)} d`, em: security.date, valor: days(security.date) }
    : { estado: 'atencao', resumo: 'Nenhuma entrada de Segurança no diário.', em: null, valor: null };
  return { seguranca, diario };
}

export async function readCockpitSignals(): Promise<CockpitSignals> {
  const [ci, { hermes, mcpLatencia }, backup, dados, entries] = await Promise.all([
    ciSignal(), hermesSignals(), backupSignal(), dataSignal(),
    storage.getAll<LogEntry>('log-entries').catch(() => [] as LogEntry[]),
  ]);
  return { verificadoEm: new Date().toISOString(), ci, hermes, mcpLatencia, backup, dados, ...logSignals(entries) };
}
