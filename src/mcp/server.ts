import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { listTools, getTool } from './registry';
import type { ToolContext } from './types';
import { appendMcpCallToCassette, captureReferencedFiles } from '../cassette/recorder';
import { isDisabled } from '../core/toggle';
import { MUTATING_MCP_TOOLS } from './mutating-tools';

/** Exported for testability. Returns true if a tool call should be refused
 *  because kadai is disabled in this project AND the tool is a mutating one. */
export function shouldRefuseMcpCall(toolName: string, rootDir: string): boolean {
  return isDisabled(rootDir) && MUTATING_MCP_TOOLS.has(toolName);
}

export async function runServer(rootDir: string): Promise<void> {
  const server = new Server(
    { name: 'kadai', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  const ctx: ToolContext = { rootDir };

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: listTools().map(t => ({
        name: t.name,
        description: t.description,
        inputSchema: zodToJsonSchema(t.inputSchema, { target: 'jsonSchema7' }) as Record<string, unknown>,
      })),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    const tool = getTool(name);
    if (!tool) {
      return {
        content: [{ type: 'text' as const, text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }
    // Refusal check BEFORE schema parsing — cheap; no need to validate args we won't use.
    if (shouldRefuseMcpCall(name, ctx.rootDir)) {
      return {
        content: [{ type: 'text' as const, text: 'kadai is disabled in this project; run `kadai enable` to re-enable.' }],
        isError: true,
      };
    }
    try {
      const parsed = tool.inputSchema.parse(args ?? {});
      // Snapshot any referenced source files BEFORE the handler runs, because
      // handlers like attach_spec/attach_plan move and remove the source file —
      // by the time we'd write the cassette entry, the file is gone.
      const files = captureReferencedFiles(parsed);
      let result: unknown;
      let ok = true;
      try {
        result = await tool.handler(parsed, ctx);
      } catch (e) {
        ok = false;
        appendMcpCallToCassette({ tool: name, args: parsed, ok, files });
        throw e;
      }
      appendMcpCallToCassette({ tool: name, args: parsed, ok, files });
      // Only `undefined` is the void/sentinel case (e.g. handlers that return nothing).
      // `null` is a meaningful value for tools like `get` (item not found) — serialize as JSON null
      // so the agent sees it clearly instead of an ambiguous "OK".
      const text = result === undefined
        ? 'OK'
        : JSON.stringify(result, null, 2);
      return { content: [{ type: 'text' as const, text }] };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        content: [{ type: 'text' as const, text: msg }],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
