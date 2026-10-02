import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { storage } from '@/lib/storage';
import { requireProfessionalOwner } from '@/lib/professional/owner-auth';

// Declared semester goals. They guide decisions and never enter balances.
const ID = 'professional-goals';
const DEFAULT_GOALS = { gross: 45000, invest: 15000, months: 6 };
const goalsSchema = z.object({
  gross: z.number().nonnegative().max(1e9),
  invest: z.number().nonnegative().max(1e9),
  months: z.number().int().min(1).max(24),
  expectedRevision: z.number().int().nonnegative(),
}).strict();
type Goals = { id: string; gross: number; invest: number; months: number; revision: number };

export async function GET(request: NextRequest) {
  try {
    await requireProfessionalOwner(request);
    const saved = await storage.getById<Goals>('professional-goals', ID);
    return NextResponse.json(saved || { id: ID, ...DEFAULT_GOALS, revision: 0 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Consulta recusada.' }, { status: 403 }); }
}

export async function PUT(request: NextRequest) {
  try {
    await requireProfessionalOwner(request);
    const input = goalsSchema.parse(await request.json());
    const result = await storage.transact<Goals, Goals>('professional-goals', items => {
      const current = items.find(item => item.id === ID);
      if ((current?.revision || 0) !== input.expectedRevision) throw new Error('As metas mudaram. Recarregue antes de salvar.');
      const next = { id: ID, gross: input.gross, invest: input.invest, months: input.months, revision: (current?.revision || 0) + 1 };
      if (current) items.splice(items.indexOf(current), 1, next); else items.push(next);
      return next;
    });
    return NextResponse.json(result);
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Metas recusadas.' }, { status: error instanceof z.ZodError ? 400 : 409 }); }
}
