'use client';

import { useEffect, useState } from 'react';
import { Copy, HeartPulse } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch, showError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import type { AppleConsentStatus } from '@/lib/health/apple';

const when = (value: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));

/** Configurações → Integrações: chave do Apple Saúde (gerar, trocar, revogar). */
export function AppleHealthSettings() {
  const [status, setStatus] = useState<AppleConsentStatus | null>(null);
  const [error, setError] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const endpoint = typeof window === 'undefined' ? '' : `${window.location.origin}/api/health/apple`;

  useEffect(() => {
    apiFetch<AppleConsentStatus>('/api/health/apple/consent').then(setStatus).catch(cause => setError(showError(cause)));
  }, []);

  async function generate() {
    if (status?.active && !window.confirm('Trocar a chave? O atalho atual para de funcionar até receber a nova.')) return;
    setBusy(true);
    try {
      const result = await apiFetch<{ token: string; status: AppleConsentStatus }>('/api/health/apple/consent', { method: 'POST' });
      setToken(result.token); setStatus(result.status);
    } catch (cause) { toast.error(showError(cause)); }
    finally { setBusy(false); }
  }
  async function revoke() {
    if (!window.confirm('Revogar a chave? O iPhone deixa de enviar dados. O que já entrou continua no histórico.')) return;
    setBusy(true);
    try { setStatus(await apiFetch<AppleConsentStatus>('/api/health/apple/consent', { method: 'DELETE' })); setToken(''); toast.success('Chave revogada.'); }
    catch (cause) { toast.error(showError(cause)); }
    finally { setBusy(false); }
  }
  async function copy(value: string, label: string) {
    try { await navigator.clipboard.writeText(value); toast.success(`${label} copiada.`); } catch { toast.error('Não foi possível copiar; selecione e copie à mão.'); }
  }

  return <section aria-label="Apple Saúde" className="space-y-3">
    <p className="flex items-center gap-2 text-sm font-medium"><HeartPulse className="h-4 w-4 text-primary" />Apple Saúde
      <span className={`rounded-full px-2 py-0.5 text-xs ${status?.active ? 'bg-money/15 text-money' : 'bg-muted text-muted-foreground'}`}>{status ? (status.active ? 'ativa' : 'desligada') : '…'}</span>
    </p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {status?.active && <p className="text-xs text-muted-foreground">
      Chave criada em {when(status.createdAt!)}
      {status.lastImportAt ? ` · último envio ${when(status.lastImportAt)}: ${status.lastImport?.created ?? 0} novos, ${status.lastImport?.duplicates ?? 0} repetidos` : ' · nenhum envio ainda'}
    </p>}
    <p className="text-xs text-muted-foreground">Sono, peso, água, treinos e passos entram como medidos pelo iPhone, separados dos seus relatos.</p>

    {token && <div className="space-y-2 rounded-lg border border-primary/40 bg-primary/5 p-3 text-xs">
      <p className="font-medium">Copie agora: a chave não aparece de novo.</p>
      <div className="flex items-center gap-2"><code className="min-w-0 flex-1 truncate rounded bg-background px-2 py-1">{token}</code><Button size="sm" variant="ghost" aria-label="Copiar chave" onClick={() => void copy(token, 'Chave')}><Copy className="h-3.5 w-3.5" /></Button></div>
      <div className="flex items-center gap-2"><code className="min-w-0 flex-1 truncate rounded bg-background px-2 py-1">{endpoint}</code><Button size="sm" variant="ghost" aria-label="Copiar endereço" onClick={() => void copy(endpoint, 'Endereço')}><Copy className="h-3.5 w-3.5" /></Button></div>
      <p>No iPhone, monte o atalho seguindo o passo a passo em docs/integrations/apple-saude.md.</p>
    </div>}

    <div className="flex flex-wrap gap-2">
      <Button size="sm" onClick={() => void generate()} disabled={busy || !status}>{status?.active ? 'Trocar chave' : 'Ligar e gerar chave'}</Button>
      {status?.active && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => void revoke()} disabled={busy}>Revogar</Button>}
    </div>
  </section>;
}
