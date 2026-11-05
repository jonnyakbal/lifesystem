'use client';

import { useState, useEffect, useRef } from 'react';
import { Sun, Moon, Download, Upload, Settings, Orbit, Gamepad2 } from 'lucide-react';
import { cn, todayStr } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { apiFetch, showError } from '@/lib/api';
import { modifierLabel, shortcutGroups } from '@/lib/shortcuts';
import type { PlanningPreferences } from '@/lib/planning-preferences';
import { DEFAULT_REVIEW_SETTINGS, REVIEW_SETTINGS_EVENT, type ReviewSettings } from '@/lib/weekly-review';
import { JourneyForm } from '@/components/tasks/task-capacity-settings';
import { AppleHealthSettings } from '@/components/settings/apple-health-settings';

export type SettingsTab = 'aparencia' | 'jornada' | 'integracoes' | 'dados' | 'atalhos';
const TABS: [SettingsTab, string][] = [['aparencia', 'Aparência'], ['jornada', 'Jornada'], ['integracoes', 'Integrações'], ['dados', 'Dados'], ['atalhos', 'Atalhos']];
const REVIEW_DAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

type Theme = 'dark' | 'light' | 'system';

function readTheme(): Theme {
  try {
    const value = localStorage.getItem('lifesystem-theme');
    return value === 'light' || value === 'system' ? value : 'dark';
  } catch { return document.documentElement.classList.contains('light') ? 'light' : 'dark'; }
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  if (theme === 'system') {
    root.classList.add(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    return;
  }
  root.classList.add(theme);
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('dark');

  useEffect(() => {
    const sync = () => {
      const stored = readTheme();
      applyTheme(stored);
      setThemeState(stored);
    };
    queueMicrotask(sync);
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', sync);
    window.addEventListener('storage', sync);
    window.addEventListener('lifesystem-theme-change', sync);
    return () => {
      media.removeEventListener('change', sync);
      window.removeEventListener('storage', sync);
      window.removeEventListener('lifesystem-theme-change', sync);
    };
  }, []);

  function setTheme(t: Theme) {
    setThemeState(t);
    applyTheme(t);
    try { localStorage.setItem('lifesystem-theme', t); } catch { /* Aplica nesta sessão mesmo com armazenamento bloqueado. */ }
    window.dispatchEvent(new Event('lifesystem-theme-change'));
  }

  return { theme, setTheme };
}

export type Skin = 'astral' | 'retro';

function readSkin(): Skin {
  try { return localStorage.getItem('lifesystem-skin') === 'retro' ? 'retro' : 'astral'; }
  catch { return document.documentElement.dataset.skin === 'retro' ? 'retro' : 'astral'; }
}

/** Visual do sistema: Astral (padrão) ou Retrô (pixel art e terminal retrofuturista).
 * É independente do tema claro/escuro; o script do layout aplica antes da pintura. */
export function useSkin() {
  const [skin, setSkinState] = useState<Skin>('astral');
  useEffect(() => {
    const sync = () => { const stored = readSkin(); document.documentElement.dataset.skin = stored; setSkinState(stored); };
    queueMicrotask(sync);
    window.addEventListener('storage', sync);
    window.addEventListener('lifesystem-skin-change', sync);
    return () => { window.removeEventListener('storage', sync); window.removeEventListener('lifesystem-skin-change', sync); };
  }, []);
  function setSkin(next: Skin) {
    setSkinState(next);
    document.documentElement.dataset.skin = next;
    try { localStorage.setItem('lifesystem-skin', next); } catch { /* Vale nesta sessão mesmo com armazenamento bloqueado. */ }
    window.dispatchEvent(new Event('lifesystem-skin-change'));
  }
  return { skin, setSkin };
}

export function SettingsDialog({ open, onOpenChange, tab = 'aparencia', onTabChange }: {
  open: boolean; onOpenChange: (v: boolean) => void; tab?: SettingsTab; onTabChange?: (tab: SettingsTab) => void;
}) {
  const { theme, setTheme } = useTheme();
  const { skin, setSkin } = useSkin();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const dataLock = useRef(false);
  const [journey, setJourney] = useState<PlanningPreferences | null>(null);
  // Recria o formulário só a cada leitura (não a cada gravação, para manter o aviso de salvo).
  const [journeyLoad, setJourneyLoad] = useState(0);
  const [journeyError, setJourneyError] = useState('');
  const [review, setReview] = useState<ReviewSettings>(DEFAULT_REVIEW_SETTINGS);
  const [mod, setMod] = useState('Ctrl');

  // A jornada só é lida quando a aba é aberta, sempre fresca.
  useEffect(() => {
    if (!open || tab !== 'jornada') return;
    let stale = false;
    queueMicrotask(() => { setJourney(null); setJourneyError(''); });
    Promise.all([apiFetch<PlanningPreferences>('/api/planning-preferences'), apiFetch<ReviewSettings>('/api/weekly-review/settings')])
      .then(([preferences, settings]) => { if (!stale) { setJourney(preferences); setReview(settings); setJourneyLoad(value => value + 1); } })
      .catch(error => { if (!stale) setJourneyError(showError(error)); });
    return () => { stale = true; };
  }, [open, tab]);
  useEffect(() => { queueMicrotask(() => setMod(modifierLabel())); }, []);

  async function saveReviewDay(reviewDay: number) {
    const previous = review;
    setReview({ reviewDay });
    try {
      const saved = await apiFetch<ReviewSettings>('/api/weekly-review/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reviewDay }) });
      window.dispatchEvent(new CustomEvent(REVIEW_SETTINGS_EVENT, { detail: saved }));
      toast.success(`Revisão semanal: ${REVIEW_DAYS[reviewDay - 1].toLowerCase()}.`);
    } catch (error) { setReview(previous); toast.error(showError(error)); }
  }

  async function handleExport() {
    if (dataLock.current) return;
    dataLock.current = true;
    setIsExporting(true);
    try {
      const [tasks, captures, content, pillars, projects, financial, journal, indicators, vision, collections] = await Promise.all([
        apiFetch<unknown[]>('/api/tasks'),
        apiFetch<unknown[]>('/api/captures'),
        apiFetch<unknown[]>('/api/content'),
        apiFetch<unknown[]>('/api/pillars'),
        apiFetch<unknown[]>('/api/projects'),
        apiFetch<unknown[]>('/api/financial'),
        apiFetch<unknown[]>('/api/journal'),
        apiFetch<unknown[]>('/api/indicators'),
        apiFetch<unknown[]>('/api/vision'),
        apiFetch<unknown[]>('/api/wiki-collections'),
      ]);
      if (![tasks, captures, content, pillars, projects, financial, journal, indicators, vision, collections].every(Array.isArray)) throw new Error('Uma área retornou dados inválidos.');

      const data = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        data: { tasks, captures, content, pillars, projects, financial, journal, indicators, vision, collections },
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lifesystem-export-${todayStr()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Dados exportados!');
    } catch (error) { toast.error(`Não foi possível exportar os dados. ${showError(error)}`); }
    finally { setIsExporting(false); dataLock.current = false; }
  }

  async function handleImport() {
    if (dataLock.current) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || dataLock.current) return;
      dataLock.current = true; setIsImporting(true);
      let imported = 0;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const allowed = new Set(['tasks', 'captures', 'content', 'pillars', 'projects', 'financial', 'journal', 'indicators', 'vision', 'collections']);
        if (!data.data || typeof data.data !== 'object' || Array.isArray(data.data)) throw new Error('Formato inválido.');
        const groups = Object.entries(data.data) as [string, unknown[]][];
        if (!groups.length || groups.some(([key, items]) => !allowed.has(key) || !Array.isArray(items) || items.some(item => !item || typeof item !== 'object' || Array.isArray(item)))) throw new Error('O arquivo contém áreas ou registros não suportados.');
        // POST cria IDs novos. Não trate registros relacionados como uma restauração:
        // preservá-los exigiria remapear vínculos e eventos em uma transação dedicada.
        if (groups.some(([group, items]) => items.some(item => {
          const row = item as Record<string, unknown>;
          return ['projectId', 'pillarId', 'accountId', 'cardId', 'collectionId', 'targetId', 'professionalWorkId', 'linkedCaptureId', 'parentId'].some(key => Boolean(row[key]))
            || ['linkedTaskIds', 'linkedProjectIds', 'linkedCaptureIds'].some(key => Array.isArray(row[key]) && row[key].length > 0)
            || (group === 'captures' && Boolean(row.category))
            || Boolean(row.planning) || Boolean(row.pillarChecks && Object.keys(row.pillarChecks as object).length);
        }))) throw new Error('Este arquivo contém vínculos ou blocos de agenda. A restauração desses vínculos ainda exige uma rotina própria; nenhum registro foi importado.');

        // Journal and Vision POSTs upsert by a natural key. Inspect every area
        // before any writes so an additive import cannot replace existing text.
        let skipped = 0;
        const prepared = await Promise.all(groups.map(async ([key, items]) => {
          const endpoint = key === 'collections' ? 'wiki-collections' : key;
          const existing = await apiFetch<Record<string, unknown>[]>(`/api/${endpoint}`);
          if (!Array.isArray(existing)) throw new Error('Não foi possível conferir os registros existentes.');
          const ids = new Set(existing.map(row => row.id).filter(Boolean));
          const naturalKey = key === 'journal' ? 'entryDate' : key === 'vision' ? 'section' : undefined;
          const naturalValues = new Set(naturalKey ? existing.map(row => row[naturalKey]).filter(Boolean) : []);
          const additions: unknown[] = [];
          for (const item of items) {
            const row = item as Record<string, unknown>;
            if (row.id && ids.has(row.id)) { skipped++; continue; }
            if (naturalKey && row[naturalKey] && naturalValues.has(row[naturalKey])) throw new Error(`Já existe um registro de ${key === 'journal' ? 'Diário nessa data' : 'Visão nessa seção'}. Nenhum registro foi importado.`);
            if (row.id) ids.add(row.id);
            if (naturalKey && row[naturalKey]) naturalValues.add(row[naturalKey]);
            additions.push(item);
          }
          return [key, additions] as const;
        }));
        for (const [key, items] of prepared) {
          const endpoint = key === 'collections' ? 'wiki-collections' : key;
          for (const item of items) {
            await apiFetch(`/api/${endpoint}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item),
            });
            imported++;
          }
        }
        toast.success(`Importado: ${imported} registros${skipped ? ` · ${skipped} já existentes ignorados` : ''}`);
        onOpenChange(false);
      } catch (error) { toast.error(`Importação interrompida: ${imported} registros adicionados. ${showError(error)}`); }
      finally { dataLock.current = false; setIsImporting(false); }
    };
    input.click();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurações
          </DialogTitle>
          <DialogDescription className="sr-only">Aparência, jornada, integrações, dados e atalhos</DialogDescription>
        </DialogHeader>

        <div role="tablist" aria-label="Seções das configurações" className="flex gap-1 border-b">
          {TABS.map(([id, label]) => <button key={id} type="button" role="tab" id={`settings-tab-${id}`} aria-selected={tab === id} aria-controls={`settings-panel-${id}`}
            onClick={() => onTabChange?.(id)}
            className={cn('-mb-px min-h-10 border-b-2 px-3 text-sm transition-colors', tab === id ? 'border-primary font-medium text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>{label}</button>)}
        </div>

        <div role="tabpanel" id={`settings-panel-${tab}`} aria-labelledby={`settings-tab-${tab}`} className="space-y-6 py-2">
          {tab === 'aparencia' && <>
            <div>
              <p className="mb-3 text-sm font-medium">Tema</p>
              <div className="flex flex-wrap gap-2">
                {([
                  { value: 'dark', label: 'Escuro', icon: Moon },
                  { value: 'light', label: 'Claro', icon: Sun },
                  { value: 'system', label: 'Sistema', icon: Settings },
                ] as const).map(opt => (
                  <Button key={opt.value} variant={theme === opt.value ? 'secondary' : 'outline'} size="sm" className="flex-1 gap-2"
                    aria-pressed={theme === opt.value} onClick={() => setTheme(opt.value)}>
                    <opt.icon className="h-4 w-4" />
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-3 text-sm font-medium">Visual</p>
              <div className="flex flex-wrap gap-2">
                {([
                  { value: 'astral', label: 'Astral', icon: Orbit },
                  { value: 'retro', label: 'Retrô pixel', icon: Gamepad2 },
                ] as const).map(opt => (
                  <Button key={opt.value} variant={skin === opt.value ? 'secondary' : 'outline'} size="sm" className="flex-1 gap-2"
                    aria-pressed={skin === opt.value} onClick={() => setSkin(opt.value)}>
                    <opt.icon className="h-4 w-4" />
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>
          </>}

          {tab === 'jornada' && <>
            {journeyError ? <p role="alert" className="text-sm text-destructive">{journeyError}</p>
              : !journey ? <p className="text-sm text-muted-foreground">Carregando…</p>
              : <JourneyForm key={journeyLoad} preferences={journey} onSaved={setJourney} />}
            <label className="block space-y-1.5 border-t pt-4 text-xs font-medium">Dia da revisão semanal
              <select value={review.reviewDay} onChange={event => void saveReviewDay(Number(event.target.value))} className="h-10 w-full rounded-md border bg-background px-3 text-base sm:text-sm">
                {REVIEW_DAYS.map((day, index) => <option key={day} value={index + 1}>{day}</option>)}
              </select>
            </label>
          </>}

          {tab === 'integracoes' && <AppleHealthSettings />}

          {tab === 'dados' && <div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={handleExport} disabled={isExporting || isImporting}>
                <Download className="h-4 w-4" />
                {isExporting ? 'Exportando...' : 'Exportar JSON'}
              </Button>
              <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={handleImport} disabled={isImporting || isExporting}>
                <Upload className="h-4 w-4" />
                {isImporting ? 'Importando…' : 'Importar JSON'}
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Exporta as áreas principais; não substitui o backup do servidor.</p>
          </div>}

          {tab === 'atalhos' && <div className="space-y-4">
            {shortcutGroups(mod).map(group => <section key={group.title} aria-label={group.title}>
              <h3 className="mb-1.5 text-xs font-medium text-muted-foreground">{group.title}</h3>
              <ul className="grid gap-x-4 sm:grid-cols-2">
                {group.items.map(item => <li key={`${item.keys.join('+')}-${item.label}`} className="flex min-h-8 items-center justify-between gap-3 text-sm">
                  <span className="truncate">{item.label}</span>
                  <span className="flex shrink-0 gap-1">{item.keys.map(key => <kbd key={key} className="rounded border bg-muted/50 px-1.5 py-0.5 font-mono text-[11px]">{key}</kbd>)}</span>
                </li>)}
              </ul>
            </section>)}
          </div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
