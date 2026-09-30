import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireProfessionalOwner } from '@/lib/professional/owner-auth';
import { correctHealthObservation, getHealthContext, getHealthSummary, listHealthObservations, listHealthProposals, recordHealthObservation } from '@/lib/health/service';
import { healthObservationSchema, healthTypeSchema } from '@/lib/health/schemas';

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('record'), observation: healthObservationSchema, idempotencyKey: z.string().min(8).max(200) }).strict(),
  z.object({ action: z.literal('correct'), id: z.string().uuid(), expectedRevision: z.number().int().positive(), observation: healthObservationSchema, reason: z.string().trim().min(3).max(500), idempotencyKey: z.string().min(8).max(200) }).strict(),
]);

export async function GET(request: NextRequest) {
  try {
    await requireProfessionalOwner(request);
    const query = request.nextUrl.searchParams;
    const view = query.get('view') || 'observations';
    if (view === 'context') return NextResponse.json(await getHealthContext());
    if (view === 'proposals') return NextResponse.json({ items: await listHealthProposals() });
    if (view === 'summary') return NextResponse.json(await getHealthSummary(query.get('from') || '', query.get('to') || ''));
    if (view !== 'observations') return NextResponse.json({ error: 'Consulta inválida.' }, { status: 400 });
    const type = query.get('type');
    if (type) healthTypeSchema.parse(type);
    return NextResponse.json(await listHealthObservations({ id: query.get('id') || undefined, type: type || undefined, indicatorId: query.get('indicatorId') || undefined, from: query.get('from') || undefined, to: query.get('to') || undefined, cursor: query.get('cursor') || undefined, limit: query.get('limit') ? Number(query.get('limit')) : undefined }));
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Consulta recusada.' }, { status: 403 }); }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireProfessionalOwner(request);
    const input = actionSchema.parse(await request.json());
    const result = input.action === 'record'
      ? await recordHealthObservation(input.observation, input.idempotencyKey, actor)
      : await correctHealthObservation(input.id, input.expectedRevision, input.observation, input.reason, input.idempotencyKey, actor);
    return NextResponse.json(result, { status: input.action === 'record' ? 201 : 200 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Registro recusado.' }, { status: 403 }); }
}
