import { storage } from '@/lib/storage';
import type { Project, Task, Content, StageConfig } from '@/types';
import { DEFAULT_STAGES } from '@/lib/default-stages';
import { summarizeFinancialMonth, type FinancialPeriodEntry } from '@/lib/financial-period';
import { querySchema, BRANDS, type ProfessionalRecord } from './schemas';
import { readLedger } from './store';

const plain = (value: unknown) => String(value || '').replace(/<[^>]*>/g, ' ').slice(0, 600);
// Owner-facing names of context fields; the raw keys stay in `gaps` for agents.
const GAP_LABELS: Record<string, string> = { objective: 'objetivo', audience: 'público', responsible: 'responsável', expectedOutcome: 'resultado esperado', milestone: 'próximo marco' };
export async function professionalQuery(raw: unknown) {
  const query = querySchema.parse(raw);
  const ledger = await readLedger();
  const allProjects = (await storage.getAll<Project & { workspaceDomain?: string }>('projects')).filter(item => item.workspaceDomain !== 'company');
  const contexts = ledger.records.filter(item => item.kind === 'context' && allProjects.some(project => project.id === item.data.projectId));
  const allowed = new Set(contexts.filter(item => !query.brandId || item.data.brandId === query.brandId).map(item => String(item.data.projectId)));
  if (query.projectId && !allowed.has(query.projectId)) throw new Error('Projeto fora do espaço profissional.');
  const visible = ledger.records.filter(item => allowed.has(String(item.data.projectId)) && (!query.projectId || item.data.projectId === query.projectId));
  const page = <T>(items: T[]) => { const offset = Number(query.cursor); return { items: items.slice(offset, offset + query.limit), total: items.length, nextCursor: offset + query.limit < items.length ? String(offset + query.limit) : null }; };
  if (query.view === 'diagnostics') return { contractVersion: '1.0', requiredScopes: ['professional:only', 'professional:read', 'professional:propose', 'professional:apply', 'professional:artifact', 'professional:execution'], externalAdapter: 'contract-only', approval: 'cookie-authenticated-human-only', scheduledJobs: false };
  if (query.view === 'stages') {
    const configs = await storage.getAll<StageConfig>('stage-configs');
    return { ...Object.fromEntries(Object.entries(DEFAULT_STAGES).map(([scope, defaults]) => [scope, configs.find(item => item.scope === scope)?.stages || defaults])), opportunities: ['lead', 'qualified', 'proposed', 'contracted', 'invoiced', 'received', 'lost'] };
  }
  if (query.view === 'proposal') {
    const proposals = ledger.proposals.filter(item => allowed.has(String(item.data.projectId)) && (!query.projectId || item.data.projectId === query.projectId) && (!query.id || item.id === query.id));
    const candidateTasks = (await storage.getAll<Task>('tasks')).filter(task => task.projectId && allowed.has(task.projectId));
    const normalized = (text: unknown) => String(text || '').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
    return page(proposals.map(item => ({ ...item, possibleExistingTasks: candidateTasks.filter(task => task.projectId === item.data.projectId && normalized(task.title) === normalized(item.data.title)).map(task => ({id: task.id, title: task.title, status: task.status})), approval: ledger.approvals.find(approval => approval.proposalId === item.id && approval.hash === item.hash && Date.parse(approval.expiresAt) > Date.now()) || null })));
  }
  if (query.view === 'jobs') return page(ledger.jobs.filter(item => allowed.has(item.projectId) && (!query.projectId || item.projectId === query.projectId) && (!query.id || item.id === query.id) && (!query.responsible || item.agentId === query.responsible)));
  function filter(item: ProfessionalRecord) {
    const date = String(item.data.dueDate || item.data.followUpDate || item.data.milestoneDate || '');
    return (!query.kind || item.kind === query.kind) && (!query.id || item.id === query.id) && (!query.responsible || item.data.responsible === query.responsible) &&
      (!query.status || item.data.status === query.status || item.data.stage === query.status) && (!query.from || date >= query.from) && (!query.to || date <= query.to && !!date) &&
      (!query.search || ['title', 'name', 'objective', 'nextAction', 'brief'].some(key => plain(item.data[key]).toLowerCase().includes(query.search!.toLowerCase())));
  }
  const compactRecord = (item: ProfessionalRecord) => query.id ? item : { ...item, data: { ...item.data, ...(typeof item.data.body === 'string' ? { body: plain(item.data.body) } : {}), ...(typeof item.data.brief === 'string' ? { brief: plain(item.data.brief) } : {}) } };
  if (query.view === 'records') return page(visible.filter(filter).map(item => ({ ...compactRecord(item), approvedRevision: ledger.proposals.some(proposal => proposal.resultId === item.id && proposal.approvalType === 'deliverable' && proposal.expectedRevision === item.revision && ledger.approvals.some(approval => approval.proposalId === proposal.id && approval.hash === proposal.hash)) ? item.revision : null })));
  const projects = allProjects.filter(item => allowed.has(item.id) && (!query.projectId || item.id === query.projectId) && (!query.search || item.name.toLowerCase().includes(query.search.toLowerCase())));
  const tasks = (await storage.getAll<Task>('tasks')).filter(item => item.projectId && allowed.has(item.projectId) && (!query.projectId || item.projectId === query.projectId) && (!query.from || !!item.dueDate && item.dueDate >= query.from) && (!query.to || !!item.dueDate && item.dueDate <= query.to) && (!query.responsible || item.responsible === query.responsible) && (!query.status || item.status === query.status) && (!query.search || item.title.toLowerCase().includes(query.search.toLowerCase())));
  const content = (await storage.getAll<Content>('content')).filter(item => item.brandId && item.linkedProjectIds?.length && item.linkedProjectIds.every(id => allowed.has(id) && contexts.some(context => context.data.projectId === id && context.data.brandId === item.brandId)) && (!query.projectId || item.linkedProjectIds?.includes(query.projectId)));
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const configuredTasks = (await storage.query<StageConfig>('stage-configs', { scope: 'tasks' }))[0]?.stages || DEFAULT_STAGES.tasks;
  const isDone = (status: string) => configuredTasks.some(stage => stage.id === status && stage.isTerminal);
  const openTasks = tasks.filter(item => !isDone(item.status));
  const works = visible.filter(item => item.kind === 'work' && item.data.status !== 'done' && filter(item));
  const summaries = projects.map(project => {
    const context = contexts.find(item => item.data.projectId === project.id)!;
    const projectWorks = works.filter(item => item.data.projectId === project.id);
    const gaps = ['objective', 'audience', 'responsible', 'expectedOutcome', 'milestone'].filter(field => !context.data[field]);
    const hasNextAction = projectWorks.some(item => item.data.nextAction) || openTasks.some(item => item.projectId === project.id);
    return { id: project.id, name: project.name, status: project.status, context, gaps: [...gaps, ...(context.data.unknowns as string[])], hasNextAction, openTasks: openTasks.filter(item => item.projectId === project.id).length, openWorks: projectWorks.length };
  });
  if (query.view === 'project') {
    if (!query.projectId) throw new Error('Informe projectId.');
    const financial = (await storage.getAll<FinancialPeriodEntry & { projectId?: string }>('financial')).filter(item => item.projectId === query.projectId);
    return { project: summaries[0], records: page(visible.filter(filter).map(compactRecord)), editais: page((await storage.getAll<{id: string; title: string; stage: string; projectId?: string}>('editais')).filter(item => item.projectId === query.projectId).map(item => ({ id: item.id, title: item.title, stage: item.stage }))), tasks: page(tasks.map(item => ({ id: item.id, title: item.title, status: item.status, dueDate: item.dueDate, priority: item.priority, description: plain(item.description) }))), content: page(content.map(item => ({ id: item.id, title: item.title, stage: item.stage, responsible: item.responsible, editorialLine: item.editorialLine }))), financial: summarizeFinancialMonth(financial, (query.from || today).slice(0, 7)), history: page(ledger.history.filter(item => visible.some(record => record.id === item.recordId))) };
  }
  const overdue = works.filter(item => item.data.dueDate && String(item.data.dueDate) < today);
  const blocked = works.filter(item => item.data.status === 'blocked' || (item.data.dependencies as string[]).some(id => ledger.records.find(record => record.id === id)?.data.status !== 'done'));
  const opportunities = visible.filter(item => item.kind === 'opportunity' && item.data.stage !== 'lost' && item.data.stage !== 'received');
  const followUps = opportunities.filter(item => item.data.followUpDate && String(item.data.followUpDate) <= (query.to || today));
  const suggestions = summaries.filter(item => !item.hasNextAction || item.gaps.length).sort((a, b) => Number(b.context.data.brandId === 'arco-labs') - Number(a.context.data.brandId === 'arco-labs')).slice(0, 5).map(item => ({ projectId: item.id, brandId: item.context.data.brandId, suggestion: !item.hasNextAction ? 'Definir uma próxima ação pequena e verificável.' : 'Revisar as lacunas antes de ampliar o trabalho.', reason: !item.hasNextAction ? 'Não há tarefa aberta nem próxima ação registrada.' : `Falta informar: ${item.gaps.map(gap => GAP_LABELS[gap] || gap).join(', ')}.`, uncertainty: 'Ausência de dados não indica abandono.', requiresApproval: true }));
  return { brands: BRANDS, projects: page(summaries), diagnostics: { withoutNextAction: summaries.filter(item => !item.hasNextAction).map(item => item.id), overdue: page(overdue), blocked: page(blocked), unassigned: page(works.filter(item => !item.data.responsible)), followUps: page(followUps) }, suggestions, counts: { projects: summaries.length, works: works.length, opportunities: opportunities.length, awaitingReview: visible.filter(item => item.kind === 'deliverable').length, legacy: { contact: visible.filter(item => item.kind === 'contact').length, opportunity: visible.filter(item => item.kind === 'opportunity').length, campaign: visible.filter(item => item.kind === 'campaign').length, content: visible.filter(item => item.kind === 'content').length } }, executionAdapter: 'contract-only' };
}
