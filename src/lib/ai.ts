// Server-side wrapper around any OpenAI-compatible chat API. Never import
// from a client component: it reads the API key.
// The /hermes page keeps its own NOUS_API_KEY provider test — separate
// integration, deliberately left alone.
//
// Provider is env-configurable on purpose. Free tiers move without notice:
// OpenCode Zen's free models answered fine on 2026-09-06 and by 2026-09-07
// returned "OpenCode's free tier can only be used in OpenCode". Swapping
// providers has to be an env change, not a redeploy.
//
//   AI_API_KEY    the key (OPENCODE_API_KEY still read, for continuity)
//   AI_BASE_URL   full chat-completions URL
//   AI_MODELS     comma-separated fallback chain, tried in order
//
// Defaults target Groq: OpenAI-compatible, free tier without a card, and
// fast enough that a sweep finishes in seconds instead of the ~60s the
// previous provider took.
const DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];

function apiKey(): string | undefined {
  return process.env.AI_API_KEY || process.env.OPENCODE_API_KEY;
}

function configuredModels(): string[] {
  const fromEnv = process.env.AI_MODELS;
  if (!fromEnv) return DEFAULT_MODELS;
  const list = fromEnv.split(',').map(s => s.trim()).filter(Boolean);
  return list.length > 0 ? list : DEFAULT_MODELS;
}

export function isAIConfigured(): boolean {
  return Boolean(apiKey());
}

interface AskOptions {
  system?: string;
  maxTokens?: number;
  model?: string;
}

// A requested model is a preference, not a restriction: it goes first, but
// the rest of the chain still backs it up. Pinning to one model would mean a
// single 429 fails the whole request, which is exactly what the chain exists
// to prevent.
function candidateModels(explicit?: string): string[] {
  const chain = configuredModels();
  const requested = explicit || process.env.OPENCODE_MODEL;
  if (!requested) return chain;
  return [requested, ...chain.filter(m => m !== requested)];
}

async function callModel(
  model: string,
  prompt: string,
  opts: AskOptions
): Promise<string> {
  const key = apiKey();
  if (!key) throw new Error('AI_API_KEY não configurada no servidor.');

  const messages: { role: string; content: string }[] = [];
  if (opts.system) messages.push({ role: 'system', content: opts.system });
  messages.push({ role: 'user', content: prompt });

  const res = await fetch(process.env.AI_BASE_URL || DEFAULT_BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ model, messages, max_tokens: opts.maxTokens ?? 2000 }),
    signal: AbortSignal.timeout(90_000),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || `Erro ${res.status} da API de IA.`);
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
