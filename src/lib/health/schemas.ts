import { z } from 'zod';
import { planningSchema } from '@/lib/task-planning';

export const healthTimeSchema = z.string().refine(value => /T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)), 'Informe data, hora e fuso reais.');
const common = { observedAt: healthTimeSchema, timezone: z.string().min(1).max(80).refine(value => { try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; } }, 'Fuso inválido.'), sourceRef: z.string().min(1).max(120).optional(), pillarId: z.string().min(1).max(120).optional(), indicatorId: z.string().min(1).max(120).optional() };

export const healthObservationSchema = z.discriminatedUnion('type', [
  z.object({ ...common, type: z.literal('sleep'), startedAt: healthTimeSchema.optional(), endedAt: healthTimeSchema.optional(), quality: z.number().int().min(0).max(10).optional() }).strict().refine(value => Boolean(value.startedAt || value.endedAt), 'Informe início ou fim do sono.'),
  z.object({ ...common, type: z.literal('weight'), kg: z.number().min(20).max(500) }).strict(),
  z.object({ ...common, type: z.literal('water'), ml: z.number().int().min(1).max(3000) }).strict(),
  z.object({ ...common, type: z.literal('meal'), description: z.string().trim().min(1).max(500) }).strict(),
  z.object({ ...common, type: z.literal('movement'), activity: z.string().trim().min(1).max(120), durationMinutes: z.number().int().min(1).max(1440).optional(), completed: z.literal(true) }).strict(),
  z.object({ ...common, type: z.literal('energy'), score: z.number().min(0).max(10) }).strict(),
  z.object({ ...common, type: z.literal('stress'), score: z.number().min(0).max(10) }).strict(),
]);
export type HealthObservationInput = z.infer<typeof healthObservationSchema>;
export const healthTypeSchema = z.enum(['sleep', 'weight', 'water', 'meal', 'movement', 'energy', 'stress']);
export const healthContextSchema = z.object({
  profile: z.string().trim().min(1).max(500).nullable(),
  objectives: z.array(z.string().trim().min(1).max(200)).max(10),
  preferences: z.array(z.string().trim().min(1).max(200)).max(20),
  routines: z.array(z.object({ dayType: z.enum(['work', 'off', 'social']), description: z.string().trim().min(1).max(500) }).strict()).max(9),
  limitations: z.string().trim().min(1).max(500).nullable(),
  equipment: z.string().trim().min(1).max(500).nullable(),
  healthPillarIds: z.array(z.string().uuid()).max(10),
}).strict();
export type HealthContextData = z.infer<typeof healthContextSchema>;
export const proposalInputSchema = z.discriminatedUnion('operation', [
  z.object({ operation: z.literal('record'), observation: healthObservationSchema, idempotencyKey: z.string().min(8).max(200) }).strict(),
  z.object({ operation: z.literal('correct'), observationId: z.string().uuid(), expectedRevision: z.number().int().positive(), observation: healthObservationSchema, reason: z.string().trim().min(3).max(500), idempotencyKey: z.string().min(8).max(200) }).strict(),
  z.object({ operation: z.literal('context'), context: healthContextSchema, expectedRevision: z.number().int().nonnegative(), idempotencyKey: z.string().min(8).max(200) }).strict(),
  z.object({ operation: z.literal('task_create'), task: z.object({ title: z.string().trim().min(1).max(300), description: z.string().trim().max(2000).optional(), priority: z.enum(['normal', 'important', 'urgent']), pillarId: z.string().uuid(), dueDate: z.iso.date().optional() }).strict(), expectedContextRevision: z.number().int().positive(), idempotencyKey: z.string().min(8).max(200) }).strict(),
  z.object({ operation: z.literal('task_plan'), taskId: z.string().uuid(), expectedTitle: z.string().trim().min(1).max(300), expectedUpdatedAt: z.string().min(1), expectedContextRevision: z.number().int().positive(), planning: planningSchema, idempotencyKey: z.string().min(8).max(200) }).strict(),
]);
export type HealthProposalInput = z.infer<typeof proposalInputSchema>;

export interface HealthActor { id: string; human: boolean }
export interface HealthObservation {
  id: string; revision: number; data: HealthObservationInput; observedAt: string; recordedAt: string; actor: string; origin: 'self_report'; idempotencyKey: string;
  durationMinutes: number | null; versions: { revision: number; data: HealthObservationInput; correctedAt: string; actor: string; reason: string }[];
}
export interface HealthProposal {
  id: string; revision: number; hash: string; actor: string; input: HealthProposalInput; createdAt: string; expiresAt: string;
  approvedAt?: string; approvedBy?: string; appliedAt?: string; resultId?: string;
}
export interface HealthReceipt { actor: string; key: string; operation: string; fingerprint: string; resultId: string; recordedAt: string }
export interface HealthContext { id: 'health-context'; revision: number; data: HealthContextData; reviewedAt: string | null; actor: string | null }
export interface HealthLedger { id: 'health-v1'; schemaVersion: 1; context?: HealthContext; observations: HealthObservation[]; proposals: HealthProposal[]; receipts: HealthReceipt[] }
