'use client';

// Floating chat panel mounted globally (see chrome-gate.tsx), the in-app
// counterpart to the MCP tools Hermes would use remotely — same data, same
// storage layer, just a different door in. Conversation state is
// client-only (raw provider message history in React state) and resets on
// reload; there's no persistence layer for chat history yet.
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bot, X, Send, Loader2, Check, Ban, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { apiFetch, showError } from '@/lib/api';
import { toast } from 'sonner';
// Type-only import: erased at compile time, so this doesn't bundle
// src/lib/ai.ts's server-only code (API keys, fetch calls) into the client.
import type { ChatMessage } from '@/lib/ai';

interface PendingAction {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

interface Bubble {
  role: 'user' | 'assistant';
  text: string;
}

export function CopilotoPanel() {
  const [open, setOpen] = useState(false);
  const [historico, setHistorico] = useState<ChatMessage[]>([]);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<{ acao: PendingAction; descricao: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [bubbles, loading, pending]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        setOpen(v => !v);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  async function enviar(mensagem: string) {
    setBubbles(prev => [...prev, { role: 'user', text: mensagem }]);
    setInput('');
    setLoading(true);
    try {
      const r = await apiFetch<{ status: string; resposta?: string; historico: ChatMessage[]; acaoPendente?: PendingAction; descricao?: string; error?: string }>(
        '/api/copiloto',
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mensagem, historico }) }
      );
      setHistorico(r.historico);
      if (r.status === 'confirmar' && r.acaoPendente) {
        setPending({ acao: r.acaoPendente, descricao: r.descricao || r.acaoPendente.name });
      } else {
        setBubbles(prev => [...prev, { role: 'assistant', text: r.resposta || '(sem resposta)' }]);
      }
    } catch (err) {
      toast.error(showError(err));
      setBubbles(prev => [...prev, { role: 'assistant', text: 'Deu erro tentando falar com a IA. Tenta de novo?' }]);
    } finally {
      setLoading(false);
    }
  }

  async function responderConfirmacao(aprovado: boolean) {
    if (!pending) return;
    const acao = pending.acao;
    setPending(null);
    setLoading(true);
    try {
      const r = await apiFetch<{ status: string; resposta?: string; historico: ChatMessage[]; acaoPendente?: PendingAction; descricao?: string }>(
        '/api/copiloto',
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ historico, confirmarAcao: { id: acao.id, aprovado } }) }
      );
      setHistorico(r.historico);
      if (r.status === 'confirmar' && r.acaoPendente) {
        setPending({ acao: r.acaoPendente, descricao: r.descricao || r.acaoPendente.name });
      } else {
        setBubbles(prev => [...prev, { role: 'assistant', text: r.resposta || '(sem resposta)' }]);
      }
    } catch (err) {
      toast.error(showError(err));
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const texto = input.trim();
    if (!texto || loading || pending) return;
    enviar(texto);
  }

  return (
    <>
      <button
        onClick={() => setOpen(v => !v)}
        className="fixed bottom-20 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-105 lg:bottom-6 lg:right-6"
        title="Copiloto (⌘M)"
      >
        {open ? <X className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            className="fixed bottom-36 right-4 z-40 flex h-[70vh] max-h-[600px] w-[92vw] max-w-sm flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl lg:bottom-24 lg:right-6"
          >
            <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
              <Sparkles className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium">Copiloto</p>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
              {bubbles.length === 0 && !loading && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Pergunta alguma coisa ou peça pra criar/atualizar algo — tarefas, projetos, editais, metas.
                </p>
              )}
              {bubbles.map((b, i) => (
                <div key={i} className={cn('flex', b.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={cn(
                    'max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap',
                    b.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  )}>
                    {b.text}
                  </div>
                </div>
              ))}

              {pending && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                  <p className="text-sm font-medium">Confirma essa ação?</p>
                  <p className="mt-1 text-sm text-muted-foreground">{pending.descricao}</p>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => responderConfirmacao(false)} disabled={loading}>
                      <Ban className="h-3.5 w-3.5" /> Cancelar
                    </Button>
                    <Button size="sm" className="gap-1.5" onClick={() => responderConfirmacao(true)} disabled={loading}>
                      <Check className="h-3.5 w-3.5" /> Confirmar
                    </Button>
                  </div>
                </div>
              )}

              {loading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Pensando...
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="flex shrink-0 items-center gap-2 border-t border-border p-3">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Pergunta ou peça algo..."
                disabled={loading || Boolean(pending)}
                className="h-9 flex-1 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
              />
              <Button type="submit" size="icon" className="h-9 w-9 shrink-0" disabled={loading || Boolean(pending) || !input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
