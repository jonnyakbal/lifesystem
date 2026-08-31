'use client';

// Management surface for the Hermes Agent integration. Split in two,
// deliberately: the MCP connection status/log is entirely LIFESYSTEM-side
// (we control that data). The prompt tester talks to Nous Research's own
// inference API (chat completions) — a different product from the Hermes
// Agent/MCP integration, included because Jonny wants to exercise the
// Hermes models directly from here too.
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Bot, CheckCircle2, XCircle, Copy, Check, Send, Loader2, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { apiFetch, showError } from '@/lib/api';

interface HermesStatus { mcpConfigured: boolean; nousConfigured: boolean; }
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
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [mcpUrl, setMcpUrl] = useState('');

  const [model, setModel] = useState(MODELS[0]);
  const [prompt, setPrompt] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ text: string; usage?: { total_tokens?: number } } | null>(null);

  useEffect(() => {
    setMcpUrl(`${window.location.origin}/api/mcp`);
    loadAll();
  }, []);

  async function loadAll() {
    try {
      const [s, l] = await Promise.all([
        apiFetch<HermesStatus>('/api/hermes/status'),
        apiFetch<McpCallLog[]>('/api/hermes/logs'),
      ]);
      setStatus(s);
      setLogs(l);
    } catch (err) {
      toast.error(showError(err));
    } finally {
      setLoading(false);
    }
  }

  function copyUrl() {
    navigator.clipboard.writeText(mcpUrl);
    setCopied(true);
    toast.success('URL copiada!');
    setTimeout(() => setCopied(false), 2000);
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
    <motion.div className="p-8 max-w-3xl" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="mb-8">
        <h1 className="flex items-center gap-2 font-display text-3xl font-bold tracking-tight">
          <Bot className="h-7 w-7 text-primary" /> Hermes
        </h1>
        <p className="text-muted-foreground">Conexão MCP com o Hermes Agent e teste direto dos modelos Hermes (Nous Research).</p>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : (
        <div className="space-y-6">
          {/* Connection status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Conexão MCP</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
                <span className="text-sm">MCP_API_KEY</span>
                {status?.mcpConfigured ? (
                  <Badge variant="outline" className="gap-1 border-money/30 bg-money/10 text-money"><CheckCircle2 className="h-3 w-3" /> Configurada</Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 border-destructive/30 bg-destructive/10 text-destructive"><XCircle className="h-3 w-3" /> Não configurada</Badge>
                )}
              </div>
              <div className="grid gap-1.5">
                <span className="text-xs text-muted-foreground">Endpoint pra configurar no Hermes</span>
                <div className="flex gap-2">
                  <code className="flex-1 truncate rounded-md border bg-muted/40 px-3 py-2 text-xs">{mcpUrl}</code>
                  <Button variant="outline" size="icon" onClick={copyUrl}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              {!status?.mcpConfigured && (
                <p className="text-xs text-muted-foreground">Configure a variável de ambiente <code>MCP_API_KEY</code> no deploy (Hostinger) e no Hermes, com o mesmo valor, pra ativar a conexão.</p>
              )}
            </CardContent>
          </Card>

          {/* Call log */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4" /> Últimas chamadas</CardTitle>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
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

          {/* Nous inference test */}
          <Card>
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
        </div>
      )}
    </motion.div>
  );
}
