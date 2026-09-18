import { z } from 'zod';

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida');

export const taskPayloadSchema = z.object({
  title: z.string().trim().max(300).optional(),
  description: z.string().max(10000).optional(),
  priority: z.enum(['urgent', 'important', 'normal']).optional(),
  // Task stages are configurable by the user (for example "prioritized"),
  // so this cannot be a fixed enum like the original default pipeline.
  status: z.string().trim().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/, 'Etapa inválida').optional(),
  projectId: z.string().max(100).optional(),
  pillarId: z.string().max(100).optional(),
  dueDate: dateOnly.optional(),
  tags: z.array(z.string().max(100)).max(50).optional(),
  checklist: z.array(z.object({
    id: z.string().max(100),
    text: z.string().max(500),
    done: z.boolean(),
  })).max(100).optional(),
  sortOrder: z.number().finite().optional(),
  recurring: z.boolean().optional(),
  recurringFrequency: z.enum(['daily', 'weekly', 'monthly']).optional(),
  completedAt: z.string().datetime().optional(),
});

export const journalPayloadSchema = z.object({
  content: z.string().max(100000),
  gratitude: z.string().max(10000).optional(),
  mood: z.enum(['great', 'good', 'neutral', 'bad', 'terrible']).optional(),
  entryDate: dateOnly,
  pillarChecks: z.record(z.string().max(100), z.number().int().min(0).max(10)),
});

export const indicatorPayloadSchema = z.object({
  pillarId: z.string().min(1).max(100),
  name: z.string().trim().min(1).max(200),
  description: z.string().max(5000).optional(),
  type: z.enum(['count', 'boolean', 'scale', 'currency', 'percentage']).default('count'),
  targetValue: z.number().finite().nonnegative().optional(),
  currentValue: z.number().finite().nonnegative().default(0),
  unit: z.string().max(50).optional(),
  frequency: z.enum(['daily', 'weekly', 'monthly']).default('weekly'),
});

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new Error('JSON inválido');
  }
}

// Content Hub schemas
export const contentSourcePayloadSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['rss', 'website', 'youtube_channel', 'youtube_playlist', 'newsletter', 'manual']),
  url: z.string().url('URL inválida'),
  description: z.string().max(500).optional(),
  icon: z.string().max(100).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor inválida').optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  isActive: z.boolean().default(true),
});

export const contentItemPayloadSchema = z.object({
  sourceId: z.string().min(1),
  title: z.string().min(1).max(500),
  url: z.string().url('URL inválida'),
  author: z.string().max(200).optional(),
  content: z.string().min(1).max(50000),
  excerpt: z.string().max(2000).optional(),
  imageUrl: z.string().max(500).optional(),
  publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, 'Data inválida').optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  category: z.string().max(100).optional(),
  status: z.enum(['unread', 'reading', 'read', 'archived']),
  importance: z.enum(['low', 'normal', 'high']),
});

export async function parseContentSource(raw: unknown): Promise<z.infer<typeof contentSourcePayloadSchema>> {
  return contentSourcePayloadSchema.parse(raw);
}

export async function parseContentItem(raw: unknown): Promise<z.infer<typeof contentItemPayloadSchema>> {
  return contentItemPayloadSchema.parse(raw);
}
