import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const endpoint = process.env.MCP_URL;
const token = process.env.MCP_API_KEY;

if (!endpoint || !token) {
  console.error('Defina MCP_URL e MCP_API_KEY no ambiente antes de executar este teste.');
  process.exitCode = 2;
} else {
  const client = new Client({ name: 'lifesystem-smoke', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
    requestInit: { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) },
  });
  try {
    await client.connect(transport);
    const tools = (await client.listTools()).tools;
    const readTool = tools.find(tool => tool.name === 'list_tasks');
    const checks = [];
    if (readTool) {
      const result = await client.callTool({ name: readTool.name, arguments: {} });
      if (result.isError) throw new Error('A ferramenta de leitura respondeu com erro.');
      checks.push('tarefas');
    }
    if (tools.some(tool => tool.name === 'get_financial_summary')) {
      const month = new Date().toISOString().slice(0, 7);
      const result = await client.callTool({ name: 'get_financial_summary', arguments: { month } });
      if (result.isError) throw new Error('O resumo financeiro respondeu com erro.');
      checks.push('resumo financeiro');
    }
    console.log(`MCP funcional: ${tools.length} ferramentas visíveis; leituras concluídas: ${checks.join(', ') || 'nenhuma no escopo da chave'}.`);
  } catch (error) {
    console.error(`Falha de conexão MCP: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}
