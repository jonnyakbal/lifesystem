import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { canUseMcpTool } from './auth';
import { runMcpToolWithAudit } from './audit';
import { logMcpCall } from './log';
import { applyHealthChange, getHealthContext, getHealthDailyBrief, getHealthReceipt, getHealthSummary, listHealthObservations, proposeHealthChange } from '@/lib/health/service';
import { readHealthLedger } from '@/lib/health/store';
import { healthContextSchema, healthObservationSchema, healthTypeSchema, proposalInputSchema } from '@/lib/health/schemas';
import { planningSchema } from '@/lib/task-planning';

const toolActions = {
  get_health_capabilities: 'health:read', get_health_schemas: 'health:read', get_health_context: 'health:read', get_health_daily_brief: 'health:read',
  list_health_observations: 'health:read', get_health_summary: 'health:read', get_health_receipt: 'health:read',
  propose_health_change: 'health:propose', apply_health_change: 'health:apply',
  record_health_observation: 'health:apply', correct_health_observation: 'health:apply',
} as const;

export function registerHealthTools(server: McpServer, scopes: string[], clientId = 'legacy') {
  const actor = { id: clientId, human: false };
  function register<S extends z.ZodRawShape>(name: keyof typeof toolActions, description: string, shape: S, execute: (input: z.infer<z.ZodObject<S>>) => Promise<unknown>) {
    if (!canUseMcpTool(name, scopes)) return;
    const concrete: z.ZodRawShape = shape;
    server.registerTool(name, { description, inputSchema: concrete }, async raw => runMcpToolWithAudit(name, async () => {
      try { return { content: [{ type: 'text' as const, text: JSON.stringify(await execute(z.object(shape).parse(raw))) }] }; }
      catch (error) { return { isError: true, content: [{ type: 'text' as const, text: error instanceof Error ? error.message : 'Operação de saúde recusada.' }] }; }
    }, (tool, success, _error, id, meta) => logMcpCall(tool, success, success ? undefined : 'health_operation_rejected', id, meta), clientId));
  }
  async function applyTyped(proposalId: string, idempotencyKey: string, operation: 'record' | 'correct') {
    const proposal = (await readHealthLedger()).proposals.find(item => item.id === proposalId);
    if (!proposal || proposal.input.operation !== operation) throw new Error('Proposta incompatível com a ferramenta.');
    return applyHealthChange(proposalId, idempotencyKey, actor);
  }
  register('get_health_capabilities', 'Descobre capacidades pessoais de saúde; nenhuma chave, dado clínico ou aprovação humana é incluída.', {}, async () => ({ contractVersion: '1.2', availableTools: Object.keys(toolActions).filter(name => canUseMcpTool(name, scopes)), permissions: ['health:read', 'health:propose', 'health:apply'].map(scope => ({ scope, granted: scopes.includes(scope) || scopes.includes('health:*') })), humanApprovalTool: false, recurringConsent: false, taskCalendarBridge: 'approved-proposals', limits: { listPageSize: 100, proposalHours: 24 } }));
  register('get_health_schemas', 'Contrato JSON dos relatos autorreferidos, contexto e ações aprovadas. Não inferir realizações. Escrever exige proposta aprovada no LifeSystem.', {}, async () => ({ contractVersion: '1.2', observation: z.toJSONSchema(healthObservationSchema), context: z.toJSONSchema(healthContextSchema), proposal: z.toJSONSchema(proposalInputSchema, { unrepresentable: 'any' }), units: { weight: 'kg', water: 'ml', sleep: 'minutes-derived', energy: '0-10', stress: '0-10' }, approvals: 'Authenticated LifeSystem UI only' }));
  register('get_health_context', 'Perfil e preferências explicitamente armazenados; null significa desconhecido, não ausência de limitação.', {}, () => getHealthContext());
  register('get_health_daily_brief', 'Resumo diário com objetivos declarados, observações, metas configuradas (não realizadas), aprovações pendentes, tarefas de pilares associados e janelas 08–20 verificadas no Google. Se a agenda falhar, freeWindows é null.', { date: z.iso.date(), timezone: z.string().min(1).max(80) }, input => getHealthDailyBrief(input.date, input.timezone));
  register('list_health_observations', 'Lista somente observações pessoais de saúde, com cursor estável; não exporta conversas.', { id: z.string().uuid().optional(), type: healthTypeSchema.optional(), indicatorId: z.string().optional(), from: z.iso.date().optional(), to: z.iso.date().optional(), cursor: z.string().uuid().optional(), limit: z.number().int().min(1).max(100).optional() }, input => listHealthObservations(input));
  register('get_health_summary', 'Resumo determinístico por período: apenas amostras observadas, cobertura e médias sem preencher dias ausentes com zero.', { from: z.iso.date(), to: z.iso.date() }, input => getHealthSummary(input.from, input.to));
  register('get_health_receipt', 'Recupera o recibo desta credencial após timeout. Reuse a mesma chave com os mesmos dados; chave diferente representa outra intenção.', { idempotencyKey: z.string().min(8).max(200) }, async input => ({ found: Boolean(await getHealthReceipt(input.idempotencyKey, actor)), receipt: await getHealthReceipt(input.idempotencyKey, actor) }));
  register('propose_health_change', 'Prepara relato, contexto, criação de tarefa ou bloco de horário exatos para revisão humana. Tarefa exige pilar de saúde no contexto versionado; bloco exige tarefa existente, título e revisão. Não grava e MCP não aprova.', { operation: z.enum(['record', 'correct', 'context', 'task_create', 'task_plan']), observation: healthObservationSchema.optional(), context: healthContextSchema.optional(), observationId: z.string().uuid().optional(), expectedRevision: z.number().int().nonnegative().optional(), expectedContextRevision: z.number().int().positive().optional(), task: z.object({ title: z.string(), description: z.string().optional(), priority: z.enum(['normal', 'important', 'urgent']), pillarId: z.string().uuid(), dueDate: z.iso.date().optional() }).optional(), taskId: z.string().uuid().optional(), expectedTitle: z.string().optional(), expectedUpdatedAt: z.string().optional(), planning: planningSchema.optional(), reason: z.string().max(500).optional(), idempotencyKey: z.string().min(8).max(200) }, input => proposeHealthChange(input, actor));
  register('apply_health_change', 'Aplica somente proposta válida e aprovada na interface autenticada; a mesma chave recupera recibo. Tarefas usam ID estável; blocos Google salvam intenção local e podem exigir retry após falha.', { proposalId: z.string().uuid(), idempotencyKey: z.string().min(8).max(200) }, input => applyHealthChange(input.proposalId, input.idempotencyKey, actor));
  register('record_health_observation', 'Aplica uma proposta aprovada do tipo record. Um boolean human/userApproved no payload não autoriza gravação.', { proposalId: z.string().uuid(), idempotencyKey: z.string().min(8).max(200) }, input => applyTyped(input.proposalId, input.idempotencyKey, 'record'));
  register('correct_health_observation', 'Aplica uma proposta aprovada do tipo correct, vinculada ao ID e à revisão da observação.', { proposalId: z.string().uuid(), idempotencyKey: z.string().min(8).max(200) }, input => applyTyped(input.proposalId, input.idempotencyKey, 'correct'));
}
