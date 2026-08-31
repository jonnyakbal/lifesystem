import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAllTools } from './tools';

export function createLifesystemMcpServer(): McpServer {
  const server = new McpServer({ name: 'lifesystem', version: '1.0.0' });
  registerAllTools(server);
  return server;
}
