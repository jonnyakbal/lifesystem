// Server-side wrapper around OpenCode Zen's OpenAI-compatible chat API.
// Never import from a client component: it reads OPENCODE_API_KEY.
// The /hermes page keeps its own NOUS_API_KEY provider test — separate
// integration, deliberately left alone.

const OPENCODE_API_URL = 'https://opencode.ai/zen/v1/chat/completions';

// Free-tier models only, tried in order. The free tier rate-limits hard
// (429 FreeUsageLimitError), so a chain is the difference between a working
// feature and a broken one. Ordered by how reliably each returned valid JSON
// for Portuguese edital text. Override with OPENCODE_MODEL.
const FREE_MODELS = [
  'nemotron-3-ultra-free',
  'big-pickle',
  'nemotron-3.5-lightning-free',
  'mimo-v2.5-free',
  'ling-3.0-flash-fin-free',
];

export function isAIConfigured(): boolean {
  return Boolean(process.env.OPENCODE_API_KEY);
}

interface AskOptions {
  system?: string;
  maxTokens?: number;
  model?: string;
}

function candidateModels(explicit?: string): string[] {
  const requested = explicit || process.env.OPENCODE_MODEL;
  return requested ? [requested] : FREE_MODELS;
}

async function callModel(
  model: string,
  prompt: string,
  opts: AskOptions
): Promise<string> {
  const apiKey = process.env.OPENCODE_API_KEY;
  if (!apiKey) throw new Error('OPENCODE_API_KEY não configurada no servidor.');

  const messages: { role: string; content: string }[] = [];
  if (opts.system) messages.push({ role: 'system', content: opts.system });
  messages.push({ role: 'user', content: prompt });

  const res = await fetch(OPENCODE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, max_tokens: opts.maxTokens ?? 2000 }),
    signal: AbortSignal.timeout(90_000),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || `Erro ${res.status} da API do OpenCode Zen.`);
  }
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('A IA devolveu uma resposta vazia.');
  return text;
}

export async function askAI(prompt: string, opts: AskOptions = {}): Promise<string> {
  let lastError = 'Nenhum modelo gratuito respondeu.';
  for (const model of candidateModels(opts.model)) {
    try {
      return await callModel(model, prompt, opts);
    } catch (err) {
      lastError = err instanceof Error ? err.message : lastError;
    }
  }
  throw new Error(lastError);
}

// Falls through to the next model when one answers but not with usable JSON —
// the smaller free models do that often enough that treating it as a hard
// failure would make the feature unreliable.
export async function askAIForJson<T>(prompt: string, opts: AskOptions = {}): Promise<T> {
  let lastError = 'Nenhum modelo gratuito respondeu.';
  for (const model of candidateModels(opts.model)) {
    let raw: string;
    try {
      raw = await callModel(model, prompt, opts);
    } catch (err) {
      lastError = err instanceof Error ? err.message : lastError;
      continue;
    }
    const parsed = extractJson(raw);
    if (parsed !== null) return parsed as T;
    lastError = 'A IA não devolveu um JSON válido.';
  }
  throw new Error(lastError);
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
