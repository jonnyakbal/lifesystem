import { test, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { storage } from '../src/lib/storage';
import { convertCaptureAction } from '../src/lib/mcp/actions';
import { updateEdital } from '../src/lib/edital-service';

test('conversão MCP exige permissão de escrita no destino', async () => {
  const convert = convertCaptureAction as (input: unknown, scopes: string[]) => Promise<unknown>;
  await expect(convert({ captureId: 'synthetic', targetType: 'financial', financial: { type: 'expense_fixed', category: 'Teste', amount: 10, date: '2030-01-01' } }, ['captures:convert'])).rejects.toThrow('destino');
});

test('efeitos de etapa de edital são executados uma vez no serviço compartilhado', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ls-edital-domain-'));
  const previous = process.env.LIFESYSTEM_DATA_DIR; process.env.LIFESYSTEM_DATA_DIR = dir;
  try {
    const edital = await storage.create('editais', { title: 'Sintético', stage: 'radar' });
    await expect(updateEdital(edital.id, { stage: 'inscrito' }, undefined, () => false)).rejects.toThrow('permissão');
    expect(await storage.getAll('tasks')).toHaveLength(0);
    await updateEdital(edital.id, { stage: 'inscrito' });
    await updateEdital(edital.id, { stage: 'inscrito' });
    expect(await storage.getAll('tasks')).toHaveLength(1);
    await updateEdital(edital.id, { stage: 'radar' });
    await updateEdital(edital.id, { stage: 'inscrito' });
    expect(await storage.getAll('tasks')).toHaveLength(1);
  } finally { if (previous === undefined) delete process.env.LIFESYSTEM_DATA_DIR; else process.env.LIFESYSTEM_DATA_DIR = previous; await rm(dir, { recursive: true, force: true }); }
});

test('edital mantém o vínculo do projeto criado e não duplica ao voltar à etapa', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ls-edital-project-link-'));
  const previous = process.env.LIFESYSTEM_DATA_DIR; process.env.LIFESYSTEM_DATA_DIR = dir;
  try {
    await storage.create('stage-configs', { scope: 'editais', stages: [{ id: 'radar', label: 'Radar' }, { id: 'approved', label: 'Aprovado', trigger: { action: 'create_project' } }] });
    const edital = await storage.create('editais', { title: 'Projeto sintético', stage: 'radar' });
    const converted = await updateEdital(edital.id, { stage: 'approved' });
    const projects = await storage.getAll<{ id: string }>('projects');
    expect(projects).toHaveLength(1);
    expect(converted?.projectId).toBe(projects[0].id);
    await updateEdital(edital.id, { stage: 'radar' });
    const repeated = await updateEdital(edital.id, { stage: 'approved' });
    expect(repeated?.projectId).toBe(projects[0].id);
    expect(await storage.getAll('projects')).toHaveLength(1);
  } finally { if (previous === undefined) delete process.env.LIFESYSTEM_DATA_DIR; else process.env.LIFESYSTEM_DATA_DIR = previous; await rm(dir, { recursive: true, force: true }); }
});
