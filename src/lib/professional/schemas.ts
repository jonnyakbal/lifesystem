import { z } from 'zod';

import { brandSchema } from './brands';
export { brandSchema, BRANDS } from './brands';
import { contentPayloadSchema } from '@/lib/content-schema';
const text = z.string().trim().max(10000);
const short = z.string().trim().max(500);
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const strings = z.array(short).max(100).default([]);
export const evidenceSchema = z.object({ statement: text, url: z.string().url().optional(), researchedAt: dateSchema.optional(), verification: z.enum(['unknown', 'researched', 'verified']).default('unknown') }).strict();
const evidence = z.array(evidenceSchema).max(100).default([]);
const binding = { projectId: z.string().min(1).max(100), brandId: brandSchema };

export const contextSchema = z.object({
  ...binding, objective: text.optional(), audience: text.optional(), problem: text.optional(), maturity: short.optional(), currentState: text.optional(),
  expectedOutcome: text.optional(), successCriteria: strings, milestone: short.optional(), milestoneDate: dateSchema.optional(), priority: z.enum(['cash', 'product', 'maintenance']).optional(), priorityReason: text.optional(),
  offer: text.optional(), valueProposition: text.optional(), facts: evidence, hypotheses: strings, unknowns: strings, restrictions: strings, decisions: strings, blockers: strings,
  resources: strings, responsible: short.optional(), materials: evidence, lastReviewedAt: dateSchema.optional(),
}).strict();
export const workSchema = z.object({
  ...binding, title: short.min(1), workType: z.enum(['human', 'agent', 'decision', 'dependency']).default('human'), responsible: short.optional(),
  milestone: short.optional(), nextAction: text.optional(), priority: z.enum(['urgent', 'important', 'normal']).default('normal'), dueDate: dateSchema.optional(), effortMinutes: z.number().int().positive().max(100000).optional(),
  brief: text.optional(), inputs: evidence, acceptanceCriteria: strings, dependencies: strings, expectedResult: text.optional(), linkedTaskId: short.optional(), origin: z.enum(['user', 'agent', 'integration']).default('user'),
  status: z.enum(['open', 'blocked', 'done']).default('open'), artifactKinds: z.array(z.enum(['prospect_list', 'script', 'message_draft', 'proposal', 'research', 'content_brief', 'experiment'])).max(10).default([]),
}).strict();
export const contactSchema = z.object({
  ...binding, name: short.min(1), entityType: z.enum(['company', 'person']).default('company'), companyId: short.optional(), segment: short.optional(), location: short.optional(),
  channels: z.array(z.object({ type: z.enum(['website', 'email', 'phone', 'social']), value: short.min(1) }).strict()).max(20).default([]),
  sources: evidence, researchedAt: dateSchema.optional(), verification: z.enum(['unknown', 'researched', 'verified']).default('unknown'), fit: text.optional(), doNotContact: z.boolean().default(false),
}).strict();
export const opportunitySchema = z.object({
  ...binding, title: short.min(1), contactId: short.optional(), stage: z.enum(['lead', 'qualified', 'proposed', 'contracted', 'invoiced', 'received', 'lost']).default('lead'),
  offering: text.optional(), grossEstimate: z.number().nonnegative().optional(), costEstimate: z.number().nonnegative().optional(), ownerShareEstimate: z.number().nonnegative().optional(),
  expectedCloseDate: dateSchema.optional(), expectedReceiptDate: dateSchema.optional(), nextAction: text.optional(), followUpDate: dateSchema.optional(), linkedTaskIds: strings, proposalIds: strings, financialIds: strings, evidence,
}).strict();
export const campaignSchema = z.object({
  ...binding, title: short.min(1), objective: text.optional(), audience: text.optional(), selectionCriteria: strings,
  prospects: z.array(z.object({ contactId: short.min(1), reason: text, evidence, qualification: z.enum(['unknown', 'qualified', 'excluded']).default('unknown') }).strict()).max(200).default([]),
  messageDrafts: z.array(z.object({ contactId: short, body: text, version: z.number().int().positive() }).strict()).max(200).default([]),
  contactHistory: z.array(z.object({ contactId: short, occurredAt: z.string().datetime(), channel: short, outcome: text, evidenceUrl: z.string().url().optional() }).strict()).max(200).default([]),
  reviewState: z.enum(['draft', 'review', 'approved']).default('draft'),
}).strict();
export const deliverableSchema = z.object({
  ...binding, title: short.min(1), type: z.enum(['prospect_list', 'script', 'message_draft', 'proposal', 'research', 'content_brief', 'experiment']), objective: text.optional(), workId: short.min(1),
  body: z.string().max(100000).default(''), fileUrl: z.string().url().optional(), sources: evidence, verificationSummary: text.optional(), comments: strings,
}).strict();

export const professionalContentSchema = contentPayloadSchema.extend({ ...binding, title: short.min(1) }).strict();
export const schemas = { content: professionalContentSchema, context: contextSchema, work: workSchema, contact: contactSchema, opportunity: opportunitySchema, campaign: campaignSchema, deliverable: deliverableSchema };
export const kindSchema = z.enum(['context', 'work', 'contact', 'opportunity', 'campaign', 'deliverable', 'content']);
export type Kind = z.infer<typeof kindSchema>;
export type Brand = z.infer<typeof brandSchema>;
export const approvalTypeSchema = z.enum(['work_scope', 'record_change', 'deliverable', 'external_action']);
export const commandSchema = z.object({
  action: z.enum(['save', 'propose', 'apply', 'artifact', 'event']), kind: kindSchema.optional(), id: short.optional(), expectedRevision: z.number().int().nonnegative().optional(),
  data: z.record(z.string(), z.unknown()).optional(), approvalType: approvalTypeSchema.optional(), idempotencyKey: z.string().min(8).max(200),
}).strict();
export const querySchema = z.object({
  view: z.enum(['overview', 'project', 'records', 'proposal', 'jobs', 'stages', 'diagnostics']).default('overview'), kind: kindSchema.optional(), id: short.optional(), projectId: short.optional(),
  brandId: brandSchema.optional(), status: short.optional(), responsible: short.optional(), search: short.optional(), from: dateSchema.optional(), to: dateSchema.optional(),
  limit: z.number().int().min(1).max(50).default(20), cursor: z.string().regex(/^\d+$/).default('0'),
}).strict();
export type Actor = { id: string; human: boolean };
export interface ProfessionalRecord { id: string; kind: Kind; revision: number; data: Record<string, unknown>; createdAt: string; updatedAt: string; author: string; originWorkId?: string; projectionUpdatedAt?: string }
export interface Proposal { id: string; revision: number; hash: string; kind: Kind; targetId?: string; expectedRevision: number; data: Record<string, unknown>; approvalType: z.infer<typeof approvalTypeSchema>; author: string; createdAt: string; expiresAt: string; resultId?: string }
export interface Approval { id: string; proposalId: string; revision: number; hash: string; author: string; expiresAt: string; approvedAt: string }
export type ExecutionState = 'queued' | 'running' | 'blocked' | 'failed' | 'review';
export interface ExternalJob { id: string; workId: string; projectId: string; brandId: Brand; agentId: string; scopeHash: string; scopeRevision: number; approvalId: string; authorizedUntil: string; execution: ExecutionState; sequence: number; boardId?: string; cardId?: string; verifiedSummary?: string; updatedAt: string; lastEventId?: string }
export interface Ledger { id: string; schemaVersion: 1; records: ProfessionalRecord[]; proposals: Proposal[]; approvals: Approval[]; jobs: ExternalJob[]; receipts: { key: string; actor: string; fingerprint: string; result: ProfessionalRecord | Proposal | ExternalJob }[]; history: { at: string; actor: string; action: string; recordId: string; revision?: number }[] }
