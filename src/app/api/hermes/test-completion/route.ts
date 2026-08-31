// Thin server-side proxy to Nous Research's inference API
// (https://inference-api.nousresearch.com/v1, OpenAI-compatible) — lets
// /hermes send a one-off test prompt without ever putting NOUS_API_KEY in
// client-side code.
import { NextRequest, NextResponse } from 'next/server';

const NOUS_API_URL = 'https://inference-api.nousresearch.com/v1/chat/completions';
const ALLOWED_MODELS = ['Hermes-4.3-36B', 'Hermes-4-70B', 'Hermes-4-405B'];

export async function POST(request: NextRequest) {
  const apiKey = process.env.NOUS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'NOUS_API_KEY não configurada no servidor.' }, { status: 400 });
  }

  const body = await request.json();
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  const model = ALLOWED_MODELS.includes(body.model) ? body.model : ALLOWED_MODELS[0];
  if (!prompt) {
    return NextResponse.json({ error: 'Prompt vazio.' }, { status: 400 });
  }

  try {
    const res = await fetch(NOUS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data.error?.message || `Erro ${res.status} da API da Nous.` }, { status: res.status });
    }

    return NextResponse.json({
      text: data.choices?.[0]?.message?.content || '',
      usage: data.usage,
      model,
    });
  } catch {
    return NextResponse.json({ error: 'Falha ao conectar com a API da Nous.' }, { status: 502 });
  }
}
