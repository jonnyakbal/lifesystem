// Server-side wrapper around OpenAI-compatible chat APIs, with fallback
// across multiple named providers. Never import from a client component: it
// reads API keys. The /hermes page keeps its own NOUS_API_KEY provider
// test — separate integration, deliberately left alone.
//
// Providers are env-configurable and tried in order, and each provider's own
// model list is also tried in order, so one 429 or a provider-wide outage
// doesn't fail the whole request. This exists because free tiers move
// without notice: OpenCode Zen's free models answered fine on 2026-09-06 and
// by 2026-09-07 returned "OpenCode's free tier can only be used in OpenCode".
// Swapping or reordering providers has to be an env change, not a redeploy.
//
// Per provider, set (replace <NAME> with the provider's key below):
//   AI_<NAME>_API_KEY    the key — provider is skipped if unset
//   AI_<NAME>_MODELS     comma-separated model chain override
// AI_PROVIDER_ORDER can reorder or narrow which providers are tried
// (comma-separated provider names, e.g. "groq,openrouter").

interface ProviderDef {
  name: string;
  baseUrl: string;
  keyEnv: string;
  modelsEnv: string;
  defaultModels: string[];
  // OpenRouter (and some other aggregators) require the ":free" suffix on
  // free model ids — routed without it, a request with any credit on the
  // account is billed instead of served for free.
}

const PROVIDERS: ProviderDef[] = [
  {
    name: 'groq',
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
    keyEnv: 'AI_GROQ_API_KEY',
    modelsEnv: 'AI_GROQ_MODELS',
    // Verified live 2026-09-08 via GET /v1/models — Groq's catalog turns
    // over completely and often (llama-3.3-70b-versatile, hardcoded here a
    // day earlier, no longer exists). Both are reasoning models: they spend
    // tokens on a "reasoning" field before "content", so a tight max_tokens
    // budget yields empty content even on a 200.
    defaultModels: ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'],
  },
  {
    name: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
    keyEnv: 'AI_OPENROUTER_API_KEY',
    modelsEnv: 'AI_OPENROUTER_MODELS',
    // Verified live 2026-09-08 via GET /v1/models (filtered to ":free" ids).
    // OpenRouter's free catalog is small (~16 models) and rotates weekly, and
    // the shared free pool 429s hard at peak times — expect this list to
    // need refreshing more often than the other providers'.
    defaultModels: [
      'google/gemma-4-31b-it:free',
      'nvidia/nemotron-3-ultra-550b-a55b:free',
    ],
  },
  {
    name: 'mistral',
    baseUrl: 'https://api.mistral.ai/v1/chat/completions',
    keyEnv: 'AI_MISTRAL_API_KEY',
    modelsEnv: 'AI_MISTRAL_MODELS',
    defaultModels: ['mistral-small-latest'],
  },
];

// Back-compat: the original single-provider env vars still work as a
// provider of their own, tried first unless AI_PROVIDER_ORDER says otherwise.
const LEGACY_PROVIDER: ProviderDef = {
  name: 'legacy',
  baseUrl: process.env.AI_BASE_URL || 'https://opencode.ai/zen/v1/chat/completions',
  keyEnv: 'AI_API_KEY',
  modelsEnv: 'AI_MODELS',
  defaultModels: [],
};

function allProviders(): ProviderDef[] {
  return [LEGACY_PROVIDER, ...PROVIDERS];
}

function providerKey(p: ProviderDef): string | undefined {
  if (p.name === 'legacy') return process.env.AI_API_KEY || process.env.OPENCODE_API_KEY;
  return process.env[p.keyEnv];
}

function providerModels(p: ProviderDef): string[] {
  const fromEnv = process.env[p.modelsEnv];
  if (fromEnv) {
    const list = fromEnv.split(',').map(s => s.trim()).filter(Boolean);
    if (list.length > 0) return list;
  }
  return p.defaultModels;
}

function orderedConfiguredProviders(): ProviderDef[] {
  const configured = allProviders().filter(p => providerKey(p) && providerModels(p).length > 0);
  const order = process.env.AI_PROVIDER_ORDER;
  if (!order) return configured;
  const names = order.split(',').map(s => s.trim()).filter(Boolean);
  const byName = new Map(configured.map(p => [p.name, p]));
  const ordered = names.map(n => byName.get(n)).filter((p): p is ProviderDef => Boolean(p));
  // Providers named in AI_PROVIDER_ORDER go first; anything configured but
  // left out of the list still runs, just last, so an omission is a
  // reordering rather than a silent disable.
  const rest = configured.filter(p => !names.includes(p.name));
  return [...ordered, ...rest];
}

export function isAIConfigured(): boolean {
  return orderedConfiguredProviders().length > 0;
}

interface AskOptions {
  system?: string;
  maxTokens?: number;
  model?: string;
}

// Raw chat message shape, close to the OpenAI wire format — used by
// chatCompletion() for multi-turn tool-calling (the Copiloto). Kept separate
// from askAI/askAIForJson's single-prompt-in-string-out shape, which several
// routes already depend on.
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
  name?: string;
}

export interface ChatTool {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

async function callModel(
  provider: ProviderDef,
  model: string,
  prompt: string,
  opts: AskOptions
): Promise<string> {
  const key = providerKey(provider);
  if (!key) throw new Error(`${provider.keyEnv} não configurada no servidor.`);

  const messages: { role: string; content: string }[] = [];
  if (opts.system) messages.push({ role: 'system', content: opts.system });
  messages.push({ role: 'user', content: prompt });

  const res = await fetch(provider.baseUrl, {
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
    throw new Error(data.error?.message || `Erro ${res.status} de ${provider.name} (${model}).`);
  }
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error(`${provider.name} (${model}) devolveu uma resposta vazia.`);
  return text;
}

// A requested model is a preference tried first on each provider, not a
// restriction — the provider's own chain still backs it up so one bad
// model doesn't take the whole provider down with it.
function candidateModels(provider: ProviderDef, explicit?: string): string[] {
  const chain = providerModels(provider);
  if (!explicit) return chain;
  return [explicit, ...chain.filter(m => m !== explicit)];
}

export async function askAI(prompt: string, opts: AskOptions = {}): Promise<string> {
  let lastError = 'Nenhum provedor de IA configurado.';
  for (const provider of orderedConfiguredProviders()) {
    for (const model of candidateModels(provider, opts.model)) {
      try {
        return await callModel(provider, model, prompt, opts);
      } catch (err) {
        lastError = err instanceof Error ? err.message : lastError;
      }
    }
  }
  throw new Error(lastError);
}

// Falls through to the next model/provider when one answers but not with
// usable JSON — smaller free models do that often enough that treating it as
// a hard failure would make the feature unreliable.
export async function askAIForJson<T>(prompt: string, opts: AskOptions = {}): Promise<T> {
  let lastError = 'Nenhum provedor de IA configurado.';
  for (const provider of orderedConfiguredProviders()) {
    for (const model of candidateModels(provider, opts.model)) {
      let raw: string;
      try {
        raw = await callModel(provider, model, prompt, opts);
      } catch (err) {
        lastError = err instanceof Error ? err.message : lastError;
        continue;
      }
      const parsed = extractJson(raw);
      if (parsed !== null) return parsed as T;
      lastError = `${provider.name} (${model}) não devolveu um JSON válido.`;
    }
  }
  throw new Error(lastError);
}

// Full multi-turn chat with tool-calling, for the Copiloto agent loop. Unlike
// callModel/askAI (single prompt, string out), this sends the whole message
// history and returns the raw assistant message — content may legitimately
// be empty when the model responds with tool_calls instead of text, so that
// case is not an error here the way it is in callModel.
async function callChatModel(
  provider: ProviderDef,
  model: string,
  messages: ChatMessage[],
  tools: ChatTool[] | undefined,
  maxTokens: number
): Promise<ChatMessage> {
  const key = providerKey(provider);
  if (!key) throw new Error(`${provider.keyEnv} não configurada no servidor.`);

  const body: Record<string, unknown> = { model, messages, max_tokens: maxTokens };
  if (tools && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }

  const res = await fetch(provider.baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90_000),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || `Erro ${res.status} de ${provider.name} (${model}).`);
  }
  const message = data.choices?.[0]?.message;
  if (!message) throw new Error(`${provider.name} (${model}) devolveu uma resposta vazia.`);
  return message;
}

export interface ChatCompletionResult {
  message: ChatMessage;
  provider: string;
  model: string;
}

export async function chatCompletion(
  messages: ChatMessage[],
  opts: { tools?: ChatTool[]; model?: string; maxTokens?: number } = {}
): Promise<ChatCompletionResult> {
  let lastError = 'Nenhum provedor de IA configurado.';
  for (const provider of orderedConfiguredProviders()) {
    for (const model of candidateModels(provider, opts.model)) {
      try {
        const message = await callChatModel(provider, model, messages, opts.tools, opts.maxTokens ?? 2000);
        return { message, provider: provider.name, model };
      } catch (err) {
        lastError = err instanceof Error ? err.message : lastError;
      }
    }
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
