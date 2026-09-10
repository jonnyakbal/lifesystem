// OpenAI-compatible chat completions endpoint, backed by the same
// Groq/OpenRouter/Mistral fallback chain in src/lib/ai.ts that the Copiloto
// and Editais features use. Built so the Hermes Agent (external, on its own
// VPS) can use LIFESYSTEM's provider fallback as its own "brain" via a
// generic "custom endpoint" provider, instead of duplicating fallback logic
// in Hermes's own per-provider config — one place to add/reorder providers.
//
// Auth reuses MCP_API_KEY (Bearer) rather than a new secret: this endpoint
// and /api/mcp are both "things external agents call", and the fallback
// chain's own AI_* keys never leave the server either way.
//
// `stream: true` gets a real SSE response, but faked: the fallback chain
// (src/lib/ai.ts) has no streaming support of its own, so we wait for the
// complete answer and then emit it as a single SSE "delta" chunk followed by
// [DONE]. The Hermes Agent's OpenAI client requires *some* SSE framing for
// streamed requests — a plain JSON body reads as a zero-chunk empty stream
// and errors — but doesn't care whether the content arrives in one chunk or
// many, so this satisfies it without a real token-by-token pipe.
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeStringEqual } from '@/lib/auth';
import { chatCompletion, type ChatMessage, type ChatTool } from '@/lib/ai';

function unauthorized() {
  return NextResponse.json({ error: { message: 'Unauthorized', type: 'invalid_request_error' } }, { status: 401 });
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.MCP_API_KEY;
  if (!apiKey) return unauthorized();

  const auth = request.headers.get('authorization') || '';
  const presented = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!presented || !timingSafeStringEqual(presented, apiKey)) return unauthorized();

  let body: {
    model?: string;
    messages?: ChatMessage[];
    max_tokens?: number;
    tools?: ChatTool[];
    stream?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { message: 'Invalid JSON body', type: 'invalid_request_error' } }, { status: 400 });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: { message: 'messages is required', type: 'invalid_request_error' } }, { status: 400 });
  }

  try {
    const { message, provider, model } = await chatCompletion(body.messages, {
      tools: body.tools,
      maxTokens: body.max_tokens,
      // The caller's `model` is a preference the fallback chain tries first,
      // not a hard pin — see candidateModels() in ai.ts. A Hermes-picked
      // model name that doesn't exist on any configured provider just falls
      // through to the chain's own defaults instead of erroring.
      model: body.model,
    });

    const id = `chatcmpl-${Date.now().toString(36)}`;
    const created = Math.floor(Date.now() / 1000);
    const responseModel = `${provider}/${model}`;
    const finishReason = message.tool_calls?.length ? 'tool_calls' : 'stop';

    if (body.stream) {
      const chunk = {
        id,
        object: 'chat.completion.chunk',
        created,
        model: responseModel,
        choices: [{ index: 0, delta: message, finish_reason: finishReason }],
      };
      const sse = `data: ${JSON.stringify(chunk)}\n\ndata: [DONE]\n\n`;
      return new NextResponse(sse, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
      });
    }

    return NextResponse.json({
      id,
      object: 'chat.completion',
      created,
      model: responseModel,
      choices: [{ index: 0, message, finish_reason: finishReason }],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    });
  } catch (err) {
    return NextResponse.json(
      { error: { message: err instanceof Error ? err.message : 'AI provider error', type: 'server_error' } },
      { status: 502 }
    );
  }
}
