import { z } from 'zod';
import { brandSchema } from '@/lib/professional/brands';
const contentFields = {
  title: z.string().max(500).optional(), body: z.string().max(200000).optional(), channel: z.enum(['blog', 'youtube', 'instagram', 'tiktok']).optional(),
  stage: z.string().max(100).optional(), category: z.string().max(200).optional(), format: z.string().max(200).optional(), tags: z.array(z.string().max(200)).max(100).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(), pinned: z.boolean().optional(), scheduledDate: z.string().optional(), scheduledTime: z.string().optional(), publishedUrl: z.string().max(2000).optional(),
  responsible: z.string().max(300).optional(), editorialLine: z.string().max(300).optional(), brandId: brandSchema.optional(), audience: z.string().max(3000).optional(), objective: z.string().max(3000).optional(), cta: z.string().max(3000).optional(),
  checklist: z.array(z.object({ id: z.string(), text: z.string().max(3000), done: z.boolean() })).max(100).optional(),
  metrics: z.object({ views: z.number().nonnegative().optional(), likes: z.number().nonnegative().optional(), comments: z.number().nonnegative().optional(), shares: z.number().nonnegative().optional() }).optional(),
  linkedTaskIds: z.array(z.string()).max(100).optional(), linkedProjectIds: z.array(z.string()).max(100).optional(), collectionId: z.string().optional(),
};
export const contentPayloadSchema = z.object(contentFields);
