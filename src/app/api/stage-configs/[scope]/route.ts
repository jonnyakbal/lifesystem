import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { StageConfig, StageScope } from '@/types';
import { DEFAULT_STAGES } from '@/lib/default-stages';

async function findConfig(scope: StageScope) {
  const matches = await storage.query<StageConfig>('stage-configs', { scope });
  return matches[0] || null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ scope: string }> }
) {
  const { scope } = await params;
  if (!(scope in DEFAULT_STAGES)) {
    return NextResponse.json({ error: 'Scope inválido' }, { status: 400 });
  }
  let config = await findConfig(scope as StageScope);
  if (!config) {
    config = await storage.create<StageConfig>('stage-configs', {
      scope: scope as StageScope,
      stages: DEFAULT_STAGES[scope as StageScope],
    });
  }
  return NextResponse.json(config);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ scope: string }> }
) {
  const { scope } = await params;
  if (!(scope in DEFAULT_STAGES)) {
    return NextResponse.json({ error: 'Scope inválido' }, { status: 400 });
  }
  const body = await request.json();
  const stages = body.stages;
  if (!Array.isArray(stages) || stages.length === 0) {
    return NextResponse.json({ error: 'É preciso pelo menos uma etapa' }, { status: 400 });
  }
  const ids = stages.map((s: { id: string }) => s.id);
  if (new Set(ids).size !== ids.length) {
    return NextResponse.json({ error: 'IDs de etapa duplicados' }, { status: 400 });
  }

  const existing = await findConfig(scope as StageScope);
  const config = existing
    ? await storage.update<StageConfig>('stage-configs', existing.id, { stages })
    : await storage.create<StageConfig>('stage-configs', { scope: scope as StageScope, stages });
  return NextResponse.json(config);
}
