import { Command } from 'commander';
import { registerReadTools } from '../mcp/handlers/reads';
import { registerGetTools } from '../mcp/handlers/get';
import { registerSearchTools } from '../mcp/handlers/search';
import { registerCreateTools } from '../mcp/handlers/creates';
import { registerStatusTools } from '../mcp/handlers/status';
import { registerPickTools } from '../mcp/handlers/picks';
import { registerAttachTools } from '../mcp/handlers/attach';
import { registerRecordChangeTool } from '../mcp/handlers/record-change';
import { runServer } from '../mcp/server';

export const mcpCommand = new Command('mcp')
  .description('Run the kadai MCP stdio server (spawned by Claude Code via .mcp.json)')
  .action(async () => {
    registerReadTools();
    registerGetTools();
    registerSearchTools();
    registerCreateTools();
    registerStatusTools();
    registerPickTools();
    registerAttachTools();
    registerRecordChangeTool();
    await runServer(process.cwd());
  });
