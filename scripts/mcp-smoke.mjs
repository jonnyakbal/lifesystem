import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const endpoint = process.env.MCP_URL;
const token = process.env.MCP_API_KEY;
const profile = process.env.MCP_SMOKE_PROFILE || 'auto';
const healthTools = ['get_health_capabilities', 'get_health_schemas', 'get_health_context', 'get_health_daily_brief', 'list_health_observations', 'get_health_summary', 'get_health_receipt', 'propose_health_change', 'apply_health_change', 'record_health_observation', 'correct_health_observation'];

// Only locally authored messages may reach logs. Transport/tool errors can
// contain response bodies, URLs or private values supplied by the server.
class SmokeFailure extends Error {}

async function readContract(client, name) {
  const result = await client.callTool({ name, arguments: {} });
  if (result.isError) throw new SmokeFailure(`A descoberta ${name} respondeu com erro.`);
  try {
    const text = result.content.find(item => item.type === 'text')?.text;
    const data = JSON.parse(text);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
    return data;
  } catch {
    throw new SmokeFailure(`A descoberta ${name} não retornou um contrato JSON válido.`);
  }
}

function proposalOperations(schema) {
  const field = schema?.properties?.operation;
  return [field?.const, ...(field?.enum || []), ...[...(schema?.oneOf || []), ...(schema?.anyOf || [])].flatMap(proposalOperations)].filter(value => typeof value === 'string');
}

async function checkHealth(client, tools) {
  const names = tools.map(tool => tool.name);
  if (names.length !== healthTools.length || healthTools.some(name => !names.includes(name)) || names.some(name => !healthTools.includes(name))) {
    throw new SmokeFailure('Catálogo incompatível com a credencial exclusiva do Órion: confira health:only e os três escopos de saúde.');
  }
  const capabilities = await readContract(client, 'get_health_capabilities');
  if (capabilities.contractVersion !== '1.2' || capabilities.taskCalendarBridge !== 'approved-proposals') {
    throw new SmokeFailure('Contrato de saúde incompatível: esta ativação exige versão 1.2 e ações por propostas aprovadas.');
  }
  if (capabilities.humanApprovalTool !== false || capabilities.recurringConsent !== false) {
    throw new SmokeFailure('O contrato não confirmou aprovação humana exclusiva e consentimento recorrente desativado.');
  }
  if (!Array.isArray(capabilities.availableTools) || capabilities.availableTools.length !== names.length || names.some(name => !capabilities.availableTools.includes(name))
    || ['health:read', 'health:propose', 'health:apply'].some(scope => !capabilities.permissions?.some(permission => permission.scope === scope && permission.granted === true))) {
    throw new SmokeFailure('Permissões efetivas ou catálogo declarado divergentes da ativação do Órion.');
  }
  const schemas = await readContract(client, 'get_health_schemas');
  if (schemas.contractVersion !== capabilities.contractVersion || !schemas.observation || !schemas.context || !schemas.proposal
    || schemas.approvals !== 'Authenticated LifeSystem UI only'
    || ['record', 'correct', 'context', 'task_create', 'task_plan'].some(operation => !proposalOperations(schemas.proposal).includes(operation))) {
    throw new SmokeFailure('Schemas de saúde incompatíveis: faltam operações ou a regra de aprovação autenticada.');
  }
  return `contrato saúde ${capabilities.contractVersion}; escopos exclusivos; aprovação humana; schemas e ponte de ações`;
}

if (!endpoint || !token) {
  console.error('Defina MCP_URL e MCP_API_KEY no ambiente antes de executar este teste.');
  process.exitCode = 2;
} else if (!['auto', 'health'].includes(profile)) {
  console.error('MCP_SMOKE_PROFILE deve ser auto ou health.');
  process.exitCode = 2;
} else {
  const client = new Client({ name: 'lifesystem-smoke', version: '1.0.0' });
  try {
    const url = new URL(endpoint);
    if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) {
      throw new SmokeFailure('Use uma URL HTTPS sem credenciais ou parâmetros; HTTP é permitido somente no loopback local.');
    }
    const transport = new StreamableHTTPClientTransport(url, {
      requestInit: { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) },
    });
    await client.connect(transport);
    const tools = [];
    const cursors = new Set();
    let cursor;
    do {
      const page = await client.listTools(cursor ? { cursor } : undefined);
      tools.push(...page.tools);
      cursor = page.nextCursor;
      if (cursor && (cursors.has(cursor) || cursors.size >= 20)) throw new SmokeFailure('Paginação inválida no catálogo MCP.');
      if (cursor) cursors.add(cursor);
    } while (cursor);
    if (profile === 'health' || tools.some(tool => tool.name === 'get_health_capabilities')) {
      const checked = await checkHealth(client, tools);
      console.log(`MCP funcional: ${tools.length} ferramentas visíveis; ${checked}. Nenhum registro pessoal consultado ou gravado.`);
      process.exitCode = 0;
    } else {
      const readTool = tools.find(tool => tool.name === 'list_tasks');
      const checks = [];
      if (readTool) {
        const result = await client.callTool({ name: readTool.name, arguments: {} });
        if (result.isError) throw new SmokeFailure('A ferramenta de leitura respondeu com erro.');
        checks.push('tarefas');
      }
      if (tools.some(tool => tool.name === 'get_financial_summary')) {
        const month = new Date().toISOString().slice(0, 7);
        const result = await client.callTool({ name: 'get_financial_summary', arguments: { month } });
        if (result.isError) throw new SmokeFailure('O resumo financeiro respondeu com erro.');
        checks.push('resumo financeiro');
      }
      if (checks.length === 0) throw new SmokeFailure('Nenhuma ferramenta verificável no escopo desta chave; handshake sozinho não valida a integração.');
      console.log(`MCP funcional: ${tools.length} ferramentas visíveis; leituras concluídas: ${checks.join(', ')}.`);
    }
  } catch (error) {
    console.error(`Falha de conexão MCP: ${error instanceof SmokeFailure ? error.message : 'autenticação, transporte ou resposta inválida. Conteúdo remoto omitido.'}`);
    process.exitCode = 1;
  } finally {
    try { await client.close(); }
    catch { console.error('Falha ao encerrar o transporte MCP. Conteúdo remoto omitido.'); process.exitCode = 1; }
  }
}
