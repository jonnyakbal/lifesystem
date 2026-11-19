import { randomUUID } from 'node:crypto';
import { storage } from '@/lib/storage';
import type { JournalEntry } from '@/types';

type JournalFields = Partial<Pick<JournalEntry, 'content' | 'gratitude' | 'mood' | 'pillarChecks'>>;

export async function listJournalEntries(filter?: { from: string; to: string; limit: number }) {
  let entries = await storage.getAll<JournalEntry>('journal');
  if (filter) {
    entries = entries.filter(entry => entry.entryDate >= filter.from && entry.entryDate <= filter.to)
      .sort((a, b) => b.entryDate.localeCompare(a.entryDate)).slice(0, filter.limit);
  }
  const pillars = await storage.getAll<{ id: string; sortOrder: number }>('pillars');
  const orderedPillars = [...pillars].sort((a, b) => a.sortOrder - b.sortOrder);
  return entries.map(entry => {
    const checks = { ...entry.pillarChecks };
    for (const [key, value] of Object.entries(entry.pillarChecks || {})) {
      if (/^[1-6]$/.test(key)) {
        const pillar = orderedPillars[Number(key) - 1];
        if (pillar) checks[pillar.id] = value;
        delete checks[key];
      }
    }
    return { ...entry, pillarChecks: checks };
  });
}

export async function saveJournalEntry(entryDate: string, fields: JournalFields, guard?: { expectedUpdatedAt?: string }) {
  return storage.transact<JournalEntry, { entry: JournalEntry; created: boolean } | null>('journal', entries => {
    const index = entries.findIndex(entry => entry.entryDate === entryDate);
    const existing = entries[index];
    if (guard && (existing ? !guard.expectedUpdatedAt || existing.updatedAt !== guard.expectedUpdatedAt : guard.expectedUpdatedAt)) {
      return null;
    }
    const previousVersion = Date.parse(existing?.updatedAt ?? '');
    const now = new Date(Math.max(Date.now(), Number.isFinite(previousVersion) ? previousVersion + 1 : 0)).toISOString();
    const entry: JournalEntry = existing
      ? { ...existing, ...fields, updatedAt: now }
      : { id: randomUUID(), createdAt: now, updatedAt: now, entryDate, ...fields, content: fields.content ?? '', pillarChecks: fields.pillarChecks ?? {} };
    if (existing) entries[index] = entry;
    else entries.push(entry);
    return { entry, created: !existing };
  });
}
