import { logMcpCall } from './log';

type ToolResult = { isError?: boolean; content: { type: 'text'; text: string }[] };
type AuditWriter = (tool: string, success: boolean, error?: string, clientId?: string) => Promise<void>;

/** Audit is observability, so its availability must never change the tool result. */
export async function runMcpToolWithAudit<T extends ToolResult>(
  tool: string,
  operation: () => Promise<T>,
  record: AuditWriter = logMcpCall,
  clientId?: string,
): Promise<T> {
  async function write(success: boolean, error?: string) {
    try {
      await record(tool, success, error, clientId);
    } catch {
      console.error(`MCP audit unavailable for ${tool}`);
    }
  }

  try {
    const result = await operation();
    await write(!result.isError, result.isError ? result.content[0]?.text : undefined);
    return result;
  } catch (error) {
    await write(false, error instanceof Error ? error.message : 'Erro desconhecido');
    throw error;
  }
}
