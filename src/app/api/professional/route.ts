import { NextRequest, NextResponse } from 'next/server';
import { professionalCommand, professionalQuery, runProfessionalBatch } from '@/lib/professional/service';
import { requireProfessionalOwner } from '@/lib/professional/owner-auth';

export async function GET(request: NextRequest) {
  try {
    await requireProfessionalOwner(request);
    const fields = Object.fromEntries(request.nextUrl.searchParams);
    if (fields.limit) (fields as Record<string, unknown>).limit = Number(fields.limit);
    return NextResponse.json(await professionalQuery(fields));
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Falha na consulta.' }, { status: 400 }); }
}
export async function POST(request: NextRequest) {
  try {
    const actor = await requireProfessionalOwner(request);
    const body = await request.json();
    return NextResponse.json(Array.isArray(body.commands) ? await runProfessionalBatch(body.commands, actor) : await professionalCommand(body, actor));
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Falha na operação.' }, { status: 409 }); }
}
