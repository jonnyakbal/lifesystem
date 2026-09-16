import { NextRequest, NextResponse } from 'next/server';
import { captureConversionSchema, convertCapture } from '@/lib/capture-conversion';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const parsed = captureConversionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Revise os dados da conversão.' }, { status: 400 });
  const { id } = await params;
  try {
    return NextResponse.json(await convertCapture(id, parsed.data));
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'Captura não encontrada') return NextResponse.json({ error: message }, { status: 404 });
    if (message === 'Esta captura já foi convertida para outro destino') return NextResponse.json({ error: message }, { status: 409 });
    return NextResponse.json({ error: message || 'Não foi possível finalizar a conversão. Tente novamente; o destino não será duplicado.' }, { status: 500 });
  }
}
