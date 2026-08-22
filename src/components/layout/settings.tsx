'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sun, Moon, Download, Upload, Settings, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

type Theme = 'dark' | 'light' | 'system';

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('dark');

  useEffect(() => {
    const stored = localStorage.getItem('lifesystem-theme') as Theme || 'dark';
    setThemeState(stored);
    applyTheme(stored);
  }, []);

  function setTheme(t: Theme) {
    setThemeState(t);
    localStorage.setItem('lifesystem-theme', t);
    applyTheme(t);
  }

  function applyTheme(t: Theme) {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    if (t === 'system') {
      const sys = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(sys);
    } else {
      root.classList.add(t);
    }
  }

  return { theme, setTheme };
}

export function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { theme, setTheme } = useTheme();
  const [isExporting, setIsExporting] = useState(false);

  async function handleExport() {
    setIsExporting(true);
    try {
      const [tasks, captures, content, pillars, projects, financial, journal, indicators, vision, collections] = await Promise.all([
        fetch('/api/tasks').then(r => r.json()),
        fetch('/api/captures').then(r => r.json()),
        fetch('/api/content').then(r => r.json()),
        fetch('/api/pillars').then(r => r.json()),
        fetch('/api/projects').then(r => r.json()),
        fetch('/api/financial').then(r => r.json()),
        fetch('/api/journal').then(r => r.json()),
        fetch('/api/indicators').then(r => r.json()),
        fetch('/api/vision').then(r => r.json()),
        fetch('/api/wiki-collections').then(r => r.json()),
      ]);

      const data = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        data: { tasks, captures, content, pillars, projects, financial, journal, indicators, vision, collections },
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lifesystem-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Dados exportados!');
    } catch {
      toast.error('Erro ao exportar');
    }
    setIsExporting(false);
  }

  async function handleImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data.data) {
          toast.error('Formato inválido');
          return;
        }

        const counts: Record<string, number> = {};
        for (const [key, items] of Object.entries(data.data) as [string, unknown[]][]) {
          const endpoint = key === 'collections' ? 'wiki-collections' : key;
          counts[key] = items.length;
          for (const item of items) {
            await fetch(`/api/${endpoint}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item),
            });
          }
        }
        toast.success(`Importado: ${Object.values(counts).reduce((a, b) => a + b, 0)} registros`);
        onOpenChange(false);
      } catch {
        toast.error('Erro ao importar arquivo');
      }
    };
    input.click();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
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
            <div className="flex gap-2">
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
              <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={handleExport} disabled={isExporting}>
                <Download className="h-4 w-4" />
                {isExporting ? 'Exportando...' : 'Exportar JSON'}
              </Button>
              <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={handleImport}>
                <Upload className="h-4 w-4" />
                Importar JSON
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Exporte um backup completo ou importe dados de outra instância
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
                <span>Tarefas</span>
                <kbd className="font-mono">⌘T</kbd>
              </div>
              <div className="flex justify-between rounded bg-muted/50 px-2 py-1">
                <span>Diário</span>
                <kbd className="font-mono">⌘L</kbd>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
