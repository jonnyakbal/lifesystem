// Server-side wrapper around the Nous Research inference API
// (OpenAI-compatible) — the same provider /api/hermes/test-completion uses.
// Never import from a client component: it reads NOUS_API_KEY.

const NOUS_API_URL = 'https://inference-api.nousresearch.com/v1/chat/completions';

export const AI_MODEL = 'Hermes-4-70B';

export function isAIConfigured(): boolean {
  return Boolean(process.env.NOUS_API_KEY);
}

interface AskOptions {
  system?: string;
  maxTokens?: number;
  model?: string;
}

export async function askAI(prompt: string, opts: AskOptions = {}): Promise<string> {
  const apiKey = process.env.NOUS_API_KEY;
  if (!apiKey) throw new Error('NOUS_API_KEY não configurada no servidor.');

  const messages: { role: string; content: string }[] = [];
  if (opts.system) messages.push({ role: 'system', content: opts.system });
  messages.push({ role: 'user', content: prompt });

  const res = await fetch(NOUS_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model || AI_MODEL,
      messages,
      max_tokens: opts.maxTokens ?? 2000,
    }),
    signal: AbortSignal.timeout(90_000),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || `Erro ${res.status} da API da Nous.`);
  }
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('A IA devolveu uma resposta vazia.');
  return text;
}

export async function askAIForJson<T>(prompt: string, opts: AskOptions = {}): Promise<T> {
  const raw = await askAI(prompt, opts);
  const parsed = extractJson(raw);
  if (parsed === null) {
    throw new Error('A IA não devolveu um JSON válido.');
  }
  return parsed as T;
}

// Models routinely wrap JSON in prose or ``` fences, so parse defensively
// instead of trusting the response to be bare JSON.
function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced ? fenced[1] : raw).trim();

  try {
    return JSON.parse(candidate);
  } catch {
    // fall through to brace-matching
  }

  const start = candidate.search(/[{[]/);
  if (start === -1) return null;
  const open = candidate[start];
  const close = open === '{' ? '}' : ']';
  const end = candidate.lastIndexOf(close);
  if (end <= start) return null;

  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}
