'use client';

// Management surface for the Hermes Agent integration. Split in two,
// deliberately: the MCP connection status/log is entirely LIFESYSTEM-side
// (we control that data). The prompt tester talks to Nous Research's own
// inference API (chat completions) — a different product from the Hermes
// Agent/MCP integration, included because Jonny wants to exercise the
// Hermes models directly from here too.
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Bot, CheckCircle2, XCircle, Copy, Check, Send, Loader2, Activity, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { apiFetch, showError } from '@/lib/api';

interface HermesStatus {
  mcpConfigured: boolean;
  mcpMode: 'none' | 'legacy' | 'scoped' | 'both';
  mcpKeyCount: number;
  lastCallAt: string | null;
  lastSuccessAt: string | null;
  recentFailures: number;
  auditAvailable: boolean;
  nousConfigured: boolean;
}
interface McpCallLog { id: string; tool: string; success: boolean; error?: string; createdAt: string; }

const MODELS = ['Hermes-4.3-36B', 'Hermes-4-70B', 'Hermes-4-405B'];

function timeAgo(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  return `há ${Math.floor(hours / 24)}d`;
}

export default function HermesPage() {
  const [status, setStatus] = useState<HermesStatus | null>(null);
  const [logs, setLogs] = useState<McpCallLog[]>([]);
  const [logsError, setLogsError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const mcpUrl = typeof window === 'undefined' ? '' : `${window.location.origin}/api/mcp`;

  const [model, setModel] = useState(MODELS[0]);
  const [prompt, setPrompt] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ text: string; usage?: { total_tokens?: number } } | null>(null);

  async function loadAll() {
    const [s, l] = await Promise.allSettled([
      apiFetch<HermesStatus>('/api/hermes/status'),
      apiFetch<McpCallLog[]>('/api/hermes/logs'),
    ]);
    if (s.status === 'fulfilled') setStatus(s.value);
    else toast.error(showError(s.reason));
    if (l.status === 'fulfilled') { setLogs(l.value); setLogsError(false); }
    else setLogsError(true);
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    // Defer the initial request one microtask so the effect stays a
    // subscription boundary rather than synchronously cascading state.
    queueMicrotask(() => { void loadAll(); });
  }, []); // loadAll is intentionally stable: it has no render-time dependencies.

  function copyUrl() {
    void navigator.clipboard.writeText(mcpUrl).then(() => {
      setCopied(true);
      toast.success('URL copiada!');
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => toast.error('Não foi possível copiar a URL.'));
  }

  async function runTest() {
    if (!prompt.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await apiFetch<{ text: string; usage?: { total_tokens?: number }; error?: string }>('/api/hermes/test-completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt: prompt.trim() }),
      });
      setTestResult(res);
    } catch (err) {
      toast.error(showError(err));
    } finally {
      setTesting(false);
    }
  }

  return (
    <motion.div className="mx-auto max-w-5xl p-4 pb-24 lg:p-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="mb-8">
        <h1 className="flex items-center gap-2 font-display text-3xl font-bold tracking-tight">
          <Bot className="h-7 w-7 text-primary" /> Hermes
        </h1>
        <p className="mt-2 text-muted-foreground">Veja se o agente está chegando ao LIFESYSTEM e quais ações executou.</p>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : (
        <div className="space-y-6">
          {/* Connection status */}
          <Card className="overflow-hidden">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Conexão MCP</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">Configuração e atividade são sinais diferentes.</p>
                </div>
                <Button variant="outline" size="sm" disabled={refreshing} onClick={() => { setRefreshing(true); void loadAll(); }} className="gap-2">
                  <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} /> Atualizar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl border bg-muted/20 p-3">
                  <span className="text-xs text-muted-foreground">Credencial</span>
                  <p className="mt-1 font-medium">{status?.mcpConfigured ? `${status.mcpKeyCount} configurada${status.mcpKeyCount !== 1 ? 's' : ''}` : 'Não configurada'}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{status?.mcpMode === 'scoped' ? 'Acesso por escopos' : status?.mcpMode === 'both' ? 'Legada e por escopos' : status?.mcpMode === 'legacy' ? 'Chave legada com acesso amplo' : 'Configure uma chave para o agente'}</p>
                </div>
                <div className="rounded-xl border bg-muted/20 p-3">
                  <span className="text-xs text-muted-foreground">Última chamada recebida</span>
                  <p className="mt-1 font-medium">{status?.auditAvailable === false ? 'Histórico indisponível' : status?.lastCallAt ? timeAgo(status.lastCallAt) : 'Ainda nenhuma'}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{status?.auditAvailable === false ? 'Não é possível confirmar a atividade agora.' : status?.lastSuccessAt ? `Última ação bem-sucedida ${timeAgo(status.lastSuccessAt)}` : 'Sem sucesso registrado'}</p>
                </div>
                <div className="rounded-xl border bg-muted/20 p-3">
                  <span className="text-xs text-muted-foreground">Saúde recente</span>
                  <p className="mt-1 font-medium">{status?.auditAvailable === false ? 'Histórico indisponível' : status?.recentFailures ? `${status.recentFailures} falha${status.recentFailures !== 1 ? 's' : ''} em 20 chamadas` : status?.lastCallAt ? 'Sem falhas recentes' : 'Aguardando uso'}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Revise as chamadas abaixo quando houver erro.</p>
                </div>
              </div>
              <div className="grid gap-1.5">
                <span className="text-xs text-muted-foreground">Endpoint para configurar no Hermes</span>
                <div className="flex gap-2">
                  <code className="flex-1 truncate rounded-md border bg-muted/40 px-3 py-2 text-xs">{mcpUrl}</code>
                  <Button variant="outline" size="icon" aria-label="Copiar endpoint MCP" onClick={copyUrl}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              {!status?.mcpConfigured && <p className="text-xs text-muted-foreground">Configure uma chave com escopos em <code>MCP_API_KEYS</code> e use a mesma chave no Hermes. Para testes iniciais, <code>MCP_API_KEY</code> também funciona, mas dá acesso amplo.</p>}
              {status?.mcpConfigured && status.auditAvailable && !status.lastCallAt && <p className="text-xs text-muted-foreground">O servidor está configurado, mas ainda não há evidência de que o Hermes chamou uma ferramenta. Faça uma consulta pelo agente e atualize esta tela.</p>}
            </CardContent>
          </Card>

          {/* Call log */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4" /> Últimas chamadas</CardTitle>
            </CardHeader>
            <CardContent>
              {logsError || status?.auditAvailable === false ? (
                <p className="py-6 text-center text-sm text-muted-foreground">O histórico está indisponível. Tente atualizar em instantes.</p>
              ) : logs.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma chamada registrada ainda. Assim que o Hermes usar uma ferramenta, aparece aqui.</p>
              ) : (
                <div className="space-y-1.5">
                  {logs.map(log => (
                    <div key={log.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                      {log.success ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-money" /> : <XCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />}
                      <code className="flex-1 truncate text-xs">{log.tool}</code>
                      {log.error && <span className="truncate text-xs text-destructive">{log.error}</span>}
                      <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(log.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* A model test is separate from the MCP connection. */}
          <details className="group rounded-xl border bg-card">
            <summary className="cursor-pointer px-6 py-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-primary">Teste de modelo Nous Research <span className="text-muted-foreground">(avançado)</span></summary>
          <Card className="border-0 shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Testar um modelo Hermes</CardTitle>
              <p className="text-sm text-muted-foreground">Chama a API de inferência da Nous Research direto, sem passar pelo Hermes Agent.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {!status?.nousConfigured && (
                <p className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-600 dark:text-yellow-400">
                  <code>NOUS_API_KEY</code> não configurada — gere uma em portal.nousresearch.com e configure a variável de ambiente pra usar o teste abaixo.
                </p>
              )}
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODELS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Escreva um prompt de teste..."
                rows={3}
              />
              <Button onClick={runTest} disabled={!prompt.trim() || testing || !status?.nousConfigured} className="gap-1.5">
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar
              </Button>
              {testResult && (
                <div className={cn('rounded-lg border px-3 py-2.5 text-sm', 'bg-muted/30')}>
                  <p className="whitespace-pre-wrap">{testResult.text}</p>
                  {testResult.usage?.total_tokens !== undefined && (
                    <p className="mt-2 text-xs text-muted-foreground">{testResult.usage.total_tokens} tokens usados</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          </details>
        </div>
      )}
    </motion.div>
  );
}
