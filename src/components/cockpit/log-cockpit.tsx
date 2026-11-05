'use client';

// Cockpit do Diário de bordo, inspirado na Central de comando do ArcoPass:
// faixa-mestra com veredito e lâmpadas, medidores, gravador de voo e mapa de
// calor. Só sinais reais (lib/cockpit.ts); sem fonte, a lâmpada fica cinza.
import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { CockpitSignals, Estado, Sinal } from '@/lib/cockpit';
import type { LogEntry, LogEntryCategory } from '@/types';

const ESTADO_COR: Record<Estado, string> = { ok: '#5BC48A', atencao: '#E7A45C', alerta: '#E5484D', desconhecido: '#7A8A90' };
const ESTADO_TEXTO: Record<Estado, string> = { ok: 'normal', atencao: 'atenção', alerta: 'alerta', desconhecido: 'sem sinal' };
const PESO: Record<Estado, number> = { desconhecido: 0, ok: 1, atencao: 2, alerta: 3 };
const CATEGORIAS: [LogEntryCategory, string, string][] = [
  ['stack', 'Stack', '#6E9BEF'], ['infra', 'Infra', '#A78BFA'], ['deploy', 'Deploy', '#4FC3D9'], ['seguranca', 'Segurança', '#E5484D'],
  ['testes', 'Testes', '#E7C35C'], ['produto', 'Produto', '#C2BEF2'], ['roadmap', 'Roadmap', '#5BC48A'], ['geral', 'Geral', '#7A8A90'],
];

function quando(value: string | null) {
  if (!value) return '';
  const date = value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value);
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', ...(value.length === 10 ? {} : { timeStyle: 'short' }) }).format(date);
}

/** Medidor em arco (SVG): 0 a máx., com faixas de atenção e alerta. */
function Medidor({ rotulo, sinal, max, atencao, alerta, unidade }: { rotulo: string; sinal: Sinal; max: number; atencao: number; alerta: number; unidade: string }) {
  const valor = sinal.valor;
  const fracao = valor === null ? 0 : Math.min(1, Math.max(0, valor / max));
  const ponto = (f: number, r = 40) => { const a = Math.PI * (1 - f); return [50 + r * Math.cos(a), 50 - r * Math.sin(a)]; };
  const arco = (de: number, ate: number) => { const [x1, y1] = ponto(de); const [x2, y2] = ponto(ate); return `M ${x1} ${y1} A 40 40 0 0 1 ${x2} ${y2}`; };
  const [px, py] = ponto(fracao, 32);
  return <figure className="flex flex-col items-center" title={sinal.resumo}>
    <svg viewBox="0 0 100 60" className="w-full max-w-[150px]" role="img" aria-label={`${rotulo}: ${valor === null ? 'sem sinal' : `${valor} ${unidade}`}`}>
      <path d={arco(0, atencao / max)} stroke={ESTADO_COR.ok} strokeOpacity=".35" strokeWidth="6" fill="none" />
      <path d={arco(atencao / max, Math.min(1, alerta / max))} stroke={ESTADO_COR.atencao} strokeOpacity=".35" strokeWidth="6" fill="none" />
      {alerta < max && <path d={arco(alerta / max, 1)} stroke={ESTADO_COR.alerta} strokeOpacity=".35" strokeWidth="6" fill="none" />}
      {valor !== null && <line x1="50" y1="50" x2={px} y2={py} stroke={ESTADO_COR[sinal.estado]} strokeWidth="2.5" strokeLinecap="round" />}
      <circle cx="50" cy="50" r="3" fill="currentColor" />
    </svg>
    <figcaption className="-mt-1 text-center">
      <span className="block font-mono text-lg leading-none" style={{ color: ESTADO_COR[sinal.estado] }}>{valor === null ? '—' : valor}<small className="ml-0.5 text-[10px] text-muted-foreground">{valor === null ? '' : unidade}</small></span>
      <span className="font-mono text-[10px] uppercase tracking-[.12em] text-muted-foreground">{rotulo}</span>
    </figcaption>
  </figure>;
}

function semanaDe(date: Date) { const d = new Date(date); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; }
const chave = (date: Date) => date.toLocaleDateString('en-CA');

export function LogCockpit({ entries }: { entries: LogEntry[] }) {
  const [sinais, setSinais] = useState<CockpitSignals | null>(null);
  const [erro, setErro] = useState('');
  useEffect(() => {
    const carregar = () => apiFetch<CockpitSignals>('/api/cockpit').then(value => { setSinais(value); setErro(''); }).catch(() => setErro('Instrumentos sem resposta.'));
    void carregar();
    const timer = window.setInterval(() => { if (!document.hidden) void carregar(); }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  // Gravador: 12 semanas, entradas por categoria. Mapa de calor: 12 semanas × 7 dias.
  const { semanas, calor, maxDia } = useMemo(() => {
    const inicio = semanaDe(new Date()); inicio.setDate(inicio.getDate() - 7 * 11);
    const semanas = Array.from({ length: 12 }, (_, i) => { const d = new Date(inicio); d.setDate(d.getDate() + i * 7); return { chave: chave(d), rotulo: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), ...Object.fromEntries(CATEGORIAS.map(([id]) => [id, 0])) } as Record<string, string | number>; });
    const porDia = new Map<string, number>();
    for (const entry of entries) {
      const dia = new Date(`${entry.date}T12:00:00`);
      const semana = semanas.find(item => item.chave === chave(semanaDe(dia)));
      if (semana) semana[entry.category] = (semana[entry.category] as number) + 1;
      porDia.set(entry.date, (porDia.get(entry.date) || 0) + 1);
    }
    const calor = Array.from({ length: 12 }, (_, w) => Array.from({ length: 7 }, (_, d) => { const dia = new Date(inicio); dia.setDate(dia.getDate() + w * 7 + d); return { dia: chave(dia), n: porDia.get(chave(dia)) || 0, futuro: dia > new Date() }; }));
    return { semanas, calor, maxDia: Math.max(1, ...porDia.values()) };
  }, [entries]);

  const lampadas: [string, Sinal | undefined][] = sinais ? [['CI', sinais.ci], ['Hermes', sinais.hermes], ['Backup', sinais.backup], ['Segurança', sinais.seguranca], ['Diário', sinais.diario]] : [];
  const pior = lampadas.reduce<Estado>((acc, [, s]) => (s && PESO[s.estado] > PESO[acc] ? s.estado : acc), 'desconhecido');
  const veredito = !sinais ? 'LIGANDO OS INSTRUMENTOS…' : pior === 'alerta' ? 'AÇÃO NECESSÁRIA' : pior === 'atencao' ? 'ATENÇÃO' : pior === 'ok' ? 'TODOS OS SISTEMAS NORMAIS' : 'SEM SINAL';
  const pedem = lampadas.filter(([, s]) => s && (s.estado === 'alerta' || s.estado === 'atencao'));
  const semSinal = lampadas.filter(([, s]) => s?.estado === 'desconhecido').length;

  return <section aria-label="Cockpit" className="mb-8 space-y-4">
    <div className="rounded-lg border border-border bg-card/60 p-4" style={{ borderLeft: `3px solid ${ESTADO_COR[pior]}` }}>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="font-mono text-xs tracking-[.14em]" style={{ color: ESTADO_COR[pior] }}>● {veredito}</span>
        <strong className="text-base font-semibold">{!sinais ? (erro || 'Lendo sinais…') : pedem.length ? `${pedem.length} ${pedem.length > 1 ? 'sinais pedem' : 'sinal pede'} você` : 'Nada pede você agora.'}</strong>
        {sinais && <span className="ml-auto font-mono text-[11px] text-muted-foreground">verificado {quando(sinais.verificadoEm)}{semSinal ? ` · ${semSinal} sem sinal` : ''}</span>}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5" aria-label="Lâmpadas">
        {lampadas.map(([nome, s]) => s && <li key={nome}>
          {(() => {
            const conteudo = <><i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: ESTADO_COR[s.estado], boxShadow: s.estado === 'desconhecido' ? 'none' : `0 0 8px ${ESTADO_COR[s.estado]}` }} />
              <span className="min-w-0"><span className="block font-mono text-[11px] uppercase tracking-[.12em]">{nome}</span><span className="block truncate text-xs text-muted-foreground">{ESTADO_TEXTO[s.estado]}{s.em ? ` · ${quando(s.em)}` : ''}</span></span></>;
            const classe = 'flex min-h-12 items-center gap-2 rounded-md border border-border/70 bg-background/40 px-3 py-2 text-left';
            return s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer" title={s.resumo} className={cn(classe, 'hover:border-primary/50')}>{conteudo}</a> : <div title={s.resumo} className={classe}>{conteudo}</div>;
          })()}
        </li>)}
      </ul>
      {pedem.length > 0 && <ul className="mt-3 space-y-1 text-sm">{pedem.map(([nome, s]) => <li key={nome}><span className="font-mono text-[11px] uppercase tracking-[.12em]" style={{ color: ESTADO_COR[s!.estado] }}>{nome}</span> · {s!.resumo}</li>)}</ul>}
    </div>

    {sinais && <div className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-card/60 p-4 sm:grid-cols-4" aria-label="Medidores">
      <Medidor rotulo="Sinal do Hermes" sinal={sinais.hermes} max={90} atencao={15} alerta={60} unidade="min" />
      <Medidor rotulo="Latência MCP" sinal={sinais.mcpLatencia} max={3000} atencao={1000} alerta={2000} unidade="ms" />
      <Medidor rotulo="Idade do backup" sinal={sinais.backup} max={336} atencao={72} alerta={336} unidade="h" />
      <Medidor rotulo="Dados" sinal={sinais.dados} max={500} atencao={200} alerta={500} unidade="MB" />
    </div>}

    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <figure className="rounded-lg border border-border bg-card/60 p-4" aria-label="Gravador de voo">
        <figcaption className="mb-2 flex items-baseline justify-between"><span className="font-mono text-[11px] uppercase tracking-[.12em] text-muted-foreground">Gravador de voo · 12 semanas</span></figcaption>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={semanas} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <XAxis dataKey="rotulo" tick={{ fontSize: 10, fill: 'currentColor' }} tickLine={false} axisLine={false} interval={1} />
              <Tooltip cursor={{ fill: 'rgba(127,127,127,.08)' }} contentStyle={{ background: 'var(--color-popover)', border: '1px solid var(--color-border)', borderRadius: 4, fontSize: 12 }} />
              {CATEGORIAS.map(([id, nome, cor]) => <Bar key={id} dataKey={id} name={nome} stackId="a" fill={cor} />)}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </figure>
      <figure className="rounded-lg border border-border bg-card/60 p-4" aria-label="Mapa de calor">
        <figcaption className="mb-2 font-mono text-[11px] uppercase tracking-[.12em] text-muted-foreground">Mapa de calor · entradas por dia</figcaption>
        <div className="flex gap-1">
          {calor.map((semana, w) => <div key={w} className="flex flex-1 flex-col gap-1">
            {semana.map(cel => <span key={cel.dia} title={`${quando(cel.dia)}: ${cel.n} entrada${cel.n === 1 ? '' : 's'}`} className="aspect-square rounded-[2px]"
              style={{ background: cel.futuro ? 'transparent' : cel.n ? `color-mix(in srgb, var(--color-primary) ${25 + (cel.n / maxDia) * 75}%, transparent)` : 'var(--color-muted)' }} />)}
          </div>)}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">seg → dom, semana mais antiga à esquerda</p>
      </figure>
    </div>
  </section>;
}
