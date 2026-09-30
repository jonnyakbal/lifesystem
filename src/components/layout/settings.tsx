'use client';

import { useState, useEffect, useRef } from 'react';
import { Sun, Moon, Download, Upload, Settings } from 'lucide-react';
import { todayStr } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { apiFetch, showError } from '@/lib/api';

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

export function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { theme, setTheme } = useTheme();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const dataLock = useRef(false);

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
      <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurações
          </DialogTitle>
          <DialogDescription>Personalize o LIFESYSTEM</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Theme */}
          <div>
            <p className="text-sm font-medium mb-3">Tema</p>
            <div className="flex flex-wrap gap-2">
              {([
                { value: 'dark', label: 'Escuro', icon: Moon },
                { value: 'light', label: 'Claro', icon: Sun },
                { value: 'system', label: 'Sistema', icon: Settings },
              ] as const).map(opt => (
                <Button
                  key={opt.value}
                  variant={theme === opt.value ? 'secondary' : 'outline'}
                  size="sm"
                  className="flex-1 gap-2"
                  aria-pressed={theme === opt.value}
                  onClick={() => setTheme(opt.value)}
                >
                  <opt.icon className="h-4 w-4" />
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Data */}
          <div>
            <p className="text-sm font-medium mb-3">Dados</p>
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
            <p className="text-xs text-muted-foreground mt-1">
              Exporta as áreas principais em JSON, sem credenciais e integrações. Não é um backup completo. A importação adiciona registros independentes; arquivos com vínculos ou agenda não são restaurados por este formulário.
            </p>
          </div>

          {/* Shortcuts */}
          <div>
            <p className="text-sm font-medium mb-3">Atalhos</p>
            <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
              <div className="flex justify-between rounded bg-muted/50 px-2 py-1">
                <span>Command Palette</span>
                <kbd className="font-mono">⌘K</kbd>
              </div>
              <div className="flex justify-between rounded bg-muted/50 px-2 py-1">
                <span>INBOX</span>
                <kbd className="font-mono">⌘I</kbd>
              </div>
              <div className="flex justify-between rounded bg-muted/50 px-2 py-1">
                <span>Hoje</span>
                <kbd className="font-mono">⌘G</kbd>
              </div>
              <div className="flex justify-between rounded bg-muted/50 px-2 py-1">
                <span>Projetos</span>
                <kbd className="font-mono">⌘J</kbd>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
