import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { Edital } from '@/types';

export async function GET() {
  const editais = await storage.getAll<Edital>('editais');
  return NextResponse.json(editais);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const edital = await storage.create<Edital>('editais', {
    title: body.title || 'Sem título',
    orgao: body.orgao,
    description: body.description,
    valor: body.valor,
    prazoInscricao: body.prazoInscricao,
    link: body.link,
    pillarId: body.pillarId,
    stage: body.stage || 'radar',
    notes: body.notes,
  });
  return NextResponse.json(edital, { status: 201 });
}
