import { storage } from '@/lib/storage';
import type { Content } from '@/types';
import { readLedger } from '@/lib/professional/store';

import { contentPayloadSchema } from '@/lib/content-schema';
export { contentPayloadSchema } from '@/lib/content-schema';
export async function validateContentBinding(data: { brandId?: string; linkedProjectIds?: string[] }) {
  if (!data.brandId) return;
  const ledger = await readLedger();
  for (const projectId of data.linkedProjectIds || []) {
    const context = ledger.records.find(item => item.kind === 'context' && item.data.projectId === projectId);
    if (!context || context.data.brandId !== data.brandId) throw new Error('Conteúdo e projeto precisam pertencer à mesma marca profissional.');
  }
}
export async function createContent(raw: unknown, stableId?: string) {
  const data = contentPayloadSchema.parse(raw); await validateContentBinding(data);
  const payload = { ...data, title: data.title || 'Sem título', body: data.body || '', channel: data.channel || 'blog', stage: (data.stage || 'idea') as Content['stage'], category: data.category || 'Geral', format: data.format || '', tags: data.tags || [], status: data.status || 'draft', pinned: data.pinned || false, checklist: data.checklist || [], linkedTaskIds: data.linkedTaskIds || [], linkedProjectIds: data.linkedProjectIds || [] };
  return stableId ? storage.createOnce<Content>('content', stableId, payload) : storage.create<Content>('content', payload);
}
export async function updateContent(id: string, raw: unknown, expectedUpdatedAt?: string) {
  const fields = contentPayloadSchema.parse(raw);
  const current = await storage.getById<Content>('content', id); if (!current) return null;
  await validateContentBinding({ ...current, ...fields });
  return storage.updateChecked<Content>('content', id, fields as Partial<Content>, expectedUpdatedAt);
}
