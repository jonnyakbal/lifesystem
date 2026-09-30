import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { approveProposal } from '@/lib/professional/service';
import { requireProfessionalOwner } from '@/lib/professional/owner-auth';
const schema = z.object({ proposalId: z.string().min(1), revision: z.number().int().positive(), hash: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export async function POST(request: NextRequest) {
  try {
    const actor = await requireProfessionalOwner(request);
    const body = schema.parse(await request.json());
    return NextResponse.json(await approveProposal(body.proposalId, body.revision, body.hash, actor));
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Aprovação recusada.' }, { status: 403 }); }
}
