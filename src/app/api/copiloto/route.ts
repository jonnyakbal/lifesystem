// The Copiloto's agent loop. Stateless on the server: the client holds the
// raw provider-format message history (`historico`) and echoes it back each
// turn, so there's no session store to manage here.
//
// Write tools (create_/update_/delete_) never execute inside the loop that
// produced them — the loop stops and returns {status:'confirmar'} with the
// pending call; the client shows a confirm card, and only a follow-up
// request with `confirmarAcao` actually runs it. Read tools execute inline
// and the loop continues, so the model can chain several lookups before
// answering. This mirrors the confirm-before-write discipline in Nave-Mãe's
// Copiloto (dona-maria/nave-app/src/lib/copiloto.ts), moved server-side.
import { NextRequest, NextResponse } from 'next/server';
import { chatCompletion, isAIConfigured, type ChatMessage } from '@/lib/ai';
import { TOOLS, isWriteTool, executeTool, describeTool, validateArgs } from '@/lib/copiloto/tools';
import { buildSystemPrompt } from '@/lib/copiloto/prompt';

const MAX_TOOL_ITERATIONS = 6;

interface PendingCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

// Guards a confirmed write against being executed twice for the same
// tool_call id. The `historico` the client echoes back isn't enough on its
// own: if the response to a successful confirm is lost in transit (a flaky
// connection, a client retry), the client still holds the PRE-confirm
// history and will resend the identical request — one with no 'tool'
// answer for that id yet, so a check against `historico` alone would not
// catch it. This module-level set is independent of what the client sends.
// It resets on server restart/redeploy, which is an acceptable gap for a
// personal single-user app — the alternative (a persisted idempotency
// store) is real infra for a very small risk window.
const EXECUTED_CALL_IDS = new Set<string>();
const MAX_TRACKED_IDS = 500;

function markExecuted(id: string) {
  EXECUTED_CALL_IDS.add(id);
  if (EXECUTED_CALL_IDS.size > MAX_TRACKED_IDS) {
    const oldest = EXECUTED_CALL_IDS.values().next().value;
    if (oldest !== undefined) EXECUTED_CALL_IDS.delete(oldest);
  }
}

function parseArgs(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function POST(request: NextRequest) {
  if (!isAIConfigured()) {
    return NextResponse.json(
      { error: 'Nenhum provedor de IA configurado no servidor (AI_GROQ_API_KEY, AI_OPENROUTER_API_KEY, etc).' },
      { status: 400 }
    );
  }

  const body = await request.json();
  const mensagem: string | undefined = typeof body.mensagem === 'string' ? body.mensagem : undefined;
  const historicoIn: ChatMessage[] = Array.isArray(body.historico) ? body.historico : [];
  const confirmarAcao: { id: string; aprovado: boolean } | undefined = body.confirmarAcao;

  let historico: ChatMessage[] = historicoIn.length > 0
    ? historicoIn
    : [{ role: 'system', content: await buildSystemPrompt() }];

  // Every tool_call in an assistant message must get a matching 'tool'
  // response before the next completion call — providers reject the request
  // otherwise. A pending confirmation is exactly that: an unanswered
  // tool_call. So a plain new message can't be sent while one is open; the
  // client must resolve it (confirmarAcao) first.
  const lastMsg = historico[historico.length - 1];
  const pendingCallIds = lastMsg?.role === 'assistant' ? (lastMsg.tool_calls || []).map(c => c.id) : [];
  const answeredIds = new Set(historico.filter(m => m.role === 'tool').map(m => m.tool_call_id));
  const stillPending = pendingCallIds.filter(id => !answeredIds.has(id));

  if (stillPending.length > 0 && !confirmarAcao) {
    return NextResponse.json(
      { error: 'Tem uma ação pendente de confirmação — resolve ela antes de mandar outra mensagem.' },
      { status: 409 }
    );
  }

  if (mensagem) {
    historico = [...historico, { role: 'user', content: mensagem }];
  }

  // Resolve a pending confirmation before resuming the loop: run (or skip)
  // exactly the tool call the client is confirming, append its result as a
  // 'tool' message, then let the model continue from there.
  if (confirmarAcao) {
    const lastAssistant = [...historico].reverse().find(m => m.role === 'assistant' && m.tool_calls?.length);
    const call = lastAssistant?.tool_calls?.find(c => c.id === confirmarAcao.id);
    if (!call) {
      return NextResponse.json({ error: 'Ação pendente não encontrada — a conversa pode ter sido reiniciada.' }, { status: 400 });
    }
    // Idempotency: a double-click or client retry re-sends the same
    // confirmation. `answeredIds` catches it when the client's echoed
    // history already has the answer; `EXECUTED_CALL_IDS` catches it even
    // when that history is stale (the case where the first response never
    // reached the client) — see the comment on EXECUTED_CALL_IDS above.
    if (answeredIds.has(call.id) || EXECUTED_CALL_IDS.has(call.id)) {
      return NextResponse.json({ status: 'concluido', resposta: 'Essa ação já tinha sido processada.', historico });
    }
    const args = parseArgs(call.function.arguments);
    let resultText: string;
    if (confirmarAcao.aprovado) {
      try {
        resultText = JSON.stringify(await executeTool(call.function.name, args));
        // Marked only on success — a genuine failure (e.g. "item not
        // found") should still be retryable, only an actual completed
        // write is guarded against repeating.
        markExecuted(call.id);
      } catch (err) {
        resultText = JSON.stringify({ erro: err instanceof Error ? err.message : 'Falha ao executar.' });
      }
    } else {
      resultText = JSON.stringify({ cancelado: true, motivo: 'O usuário não confirmou essa ação.' });
    }
    historico = [...historico, { role: 'tool', tool_call_id: call.id, name: call.function.name, content: resultText }];
  }

  try {
    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const { message } = await chatCompletion(historico, { tools: TOOLS, maxTokens: 2000 });
      historico = [...historico, message];

      if (!message.tool_calls || message.tool_calls.length === 0) {
        return NextResponse.json({ status: 'concluido', resposta: message.content || '', historico });
      }

      // Every tool_call below MUST end up with a matching 'tool' response by
      // the time we return or loop again — reads execute right away, and
      // even a write we pause on (or reject/defer) gets an entry, so the
      // message array is always valid for the next completion call.
      let pending: { call: (typeof message.tool_calls)[number]; args: Record<string, unknown> } | null = null;

      for (const call of message.tool_calls) {
        const args = parseArgs(call.function.arguments);

        if (isWriteTool(call.function.name)) {
          const invalid = validateArgs(call.function.name, args);
          if (invalid) {
            historico = [...historico, { role: 'tool', tool_call_id: call.id, name: call.function.name, content: JSON.stringify({ erro: invalid }) }];
            continue;
          }
          if (pending) {
            // Only one write is confirmed per turn — a second simultaneous
            // write call is deferred rather than silently dropped, so the
            // model can ask for it again once the first is resolved.
            historico = [...historico, { role: 'tool', tool_call_id: call.id, name: call.function.name, content: JSON.stringify({ adiado: true, motivo: 'Só uma ação de escrita por vez — peça essa de novo depois.' }) }];
            continue;
          }
          pending = { call, args };
          continue;
        }

        let resultText: string;
        try {
          resultText = JSON.stringify(await executeTool(call.function.name, args));
        } catch (err) {
          resultText = JSON.stringify({ erro: err instanceof Error ? err.message : 'Falha ao consultar.' });
        }
        historico = [...historico, { role: 'tool', tool_call_id: call.id, name: call.function.name, content: resultText }];
      }

      if (pending) {
        return NextResponse.json({
          status: 'confirmar',
          acaoPendente: { id: pending.call.id, name: pending.call.function.name, args: pending.args } satisfies PendingCall,
          descricao: describeTool(pending.call.function.name, pending.args),
          historico,
        });
      }
      // No pending write — every tool_call this turn was a read (or an
      // invalid write we already answered with an error) and loop continues.
    }

    return NextResponse.json({
      status: 'concluido',
      resposta: 'Isso precisou de mais passos do que eu consigo encadear de uma vez — tenta reformular ou dividir em partes?',
      historico,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Falha ao conversar com a IA.' },
      { status: 502 }
    );
  }
}
