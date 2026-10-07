'use client';

import { useCallback, useEffect, useState } from 'react';
import { Database, RefreshCw, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WorkspaceHeading } from '@/components/workspace/workspace-heading';

type Row = { name: string; status: 'missing' | 'same' | 'different' | 'separate' | 'invalid'; fileItems: number | null; d1Items: number | null; error?: string };
type Plan = { mode: string; d1Configured: boolean; collections: Row[]; ready: boolean };
type Result = { name: string; outcome: string; detail?: string };

const statusLabel: Record<Row['status'], string> = {
  missing: 'Ainda não está no D1',
  same: 'Igual no D1 ✓',
  different: 'Diferente no D1',
  separate: 'Fica em arquivo (armazenamento próprio)',
  invalid: 'Arquivo ilegível',
};
const outcomeLabel: Record<string, string> = {
  copied: 'copiado e conferido', replaced: 'substituído e conferido', unchanged: 'já estava igual',
  kept: 'mantido (diferente no D1)', skipped: 'ignorado', failed: 'falhou',
};

export default function DadosPage() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);
  const [replace, setReplace] = useState<string[]>([]);

  const load = useCallback(async () => {
    setError('');
    try {
      const r = await fetch('/api/storage/d1-migration', { cache: 'no-store' });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Falha ao comparar.');
      setPlan(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao comparar.');
    }
  }, []);
  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  async function copy() {
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/storage/d1-migration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ replace }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Falha ao copiar.');
      setResults(data.results);
      setPlan(data.plan);
      setReplace([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao copiar.');
    } finally {
      setBusy(false);
    }
  }

  const rows = plan?.collections || [];
  const different = rows.filter((r) => r.status === 'different');
  return (
    <main className="work-page mx-auto max-w-[1100px] px-4 pb-28 pt-6 lg:px-8">
      <WorkspaceHeading
        eyebrow="Sistema · armazenamento"
        title="Banco de dados"
        description="Copia seus registros dos arquivos do servidor para o banco D1 da Cloudflare. Os arquivos não são alterados e continuam sendo a volta segura."
      />
      {error && <div role="alert" className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm">{error}</div>}
      {!plan && !error && <p className="text-sm text-muted-foreground">Comparando arquivos e D1…</p>}
      {plan && (
        <>
          <section aria-label="Situação" className="mb-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Usando agora</p><p className="mt-1 text-lg font-semibold">{plan.mode === 'd1' ? 'Banco D1' : 'Arquivos'}</p></div>
            <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">D1 configurado</p><p className="mt-1 text-lg font-semibold">{plan.d1Configured ? 'Sim' : 'Não'}</p></div>
            <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Pronto para trocar</p><p className="mt-1 text-lg font-semibold">{plan.ready ? 'Sim ✓' : 'Ainda não'}</p></div>
          </section>

          <div className="mb-4 flex flex-wrap gap-2">
            <Button onClick={() => void copy()} disabled={busy || !plan.d1Configured} className="min-h-11 gap-2">
              <Upload className="h-4 w-4" />{busy ? 'Copiando e conferindo…' : 'Copiar para o D1'}
            </Button>
            <Button variant="outline" onClick={() => void load()} disabled={busy} className="min-h-11 gap-2">
              <RefreshCw className="h-4 w-4" />Conferir de novo
            </Button>
          </div>

          {results && (
            <section aria-label="Resultado da cópia" className="mb-6 rounded-xl border p-4 text-sm">
              <p className="mb-2 font-medium">Resultado</p>
              <ul className="grid gap-1">
                {results.map((r) => <li key={r.name}><span className="font-mono">{r.name}</span>: {outcomeLabel[r.outcome] || r.outcome}{r.detail ? ` (${r.detail})` : ''}</li>)}
              </ul>
            </section>
          )}

          <section aria-label="Coleções" className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="p-3">Coleção</th><th className="p-3">Arquivo</th><th className="p-3">D1</th><th className="p-3">Situação</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.name} className="border-b last:border-0">
                    <td className="p-3 font-mono"><Database className="mr-1 inline h-3.5 w-3.5" />{r.name}</td>
                    <td className="p-3">{r.fileItems ?? '—'}</td>
                    <td className="p-3">{r.d1Items ?? '—'}</td>
                    <td className="p-3">
                      {statusLabel[r.status]}{r.error ? ` (${r.error})` : ''}
                      {r.status === 'different' && (
                        <label className="ml-2 inline-flex items-center gap-1 text-xs">
                          <input type="checkbox" checked={replace.includes(r.name)} onChange={(e) => setReplace((cur) => e.target.checked ? [...cur, r.name] : cur.filter((n) => n !== r.name))} />
                          substituir pelo arquivo
                        </label>
                      )}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={4} className="p-3 text-muted-foreground">Nenhum arquivo de dados encontrado.</td></tr>}
              </tbody>
            </table>
          </section>
          {different.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Coleções “diferentes” nunca são substituídas sozinhas. Marque só as que você quer trocar pela versão dos arquivos.</p>}

          <section aria-label="Próximo passo" className="mt-6 rounded-xl border p-4 text-sm leading-relaxed">
            <p className="font-medium">Como trocar para o D1</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Copie e espere todas as coleções ficarem “Igual no D1 ✓”.</li>
              <li>Não use o app entre a cópia e a troca: o que for salvo nesse meio fica só nos arquivos. Na dúvida, clique em “Conferir de novo” logo antes de trocar.</li>
              <li>Na Hostinger, crie a variável <code>LIFESYSTEM_STORAGE</code> com o valor <code>d1</code> e faça o deploy.</li>
              <li>Para voltar aos arquivos, apague a variável. O que for salvo já no D1 não volta sozinho para os arquivos.</li>
            </ol>
          </section>
        </>
      )}
    </main>
  );
}
