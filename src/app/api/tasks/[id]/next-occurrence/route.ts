import { NextResponse } from 'next/server';
import { spawnNextTaskOccurrence } from '@/lib/task-domain';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return NextResponse.json(await spawnNextTaskOccurrence((await params).id)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível gerar a ocorrência.' }, { status: 409 }); }
}
