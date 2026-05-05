import { z } from 'zod';
import { findById } from '../../core/spine';
import { readPicked } from '../../core/picked';
import { registerTool } from '../registry';

export function registerGetTools(): void {
  registerTool({
    name: 'get',
    description: 'Fetch a single item (epic, feature, story, or task) by its ID. Returns null if not found.',
    inputSchema: z.object({
      id: z.string().regex(/^(EPIC|FEAT|STORY|TASK)-\d+$/),
    }),
    handler: async (args, ctx) => {
      return findById(ctx.rootDir, (args as any).id);
    },
  });

  registerTool({
    name: 'get_active_story',
    description: 'Get the currently picked story (the one the agent is actively working on). Returns null if no story is picked.',
    inputSchema: z.object({}),
    handler: async (_args, ctx) => {
      const id = readPicked(ctx.rootDir);
      if (!id) return null;
      return findById(ctx.rootDir, id);
    },
  });
}
