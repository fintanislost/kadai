import { z } from 'zod';
import { setPicked, clearPicked } from '../../core/picked';
import { findById } from '../../core/spine';
import { registerTool } from '../registry';

export function registerPickTools(): void {
  registerTool({
    name: 'pick_story',
    description: 'Set the active story (the one the agent is currently editing code for). Only stories can be picked. Does NOT change the story\'s status — call set_status separately if you also want to mark the story in_progress.',
    inputSchema: z.object({
      id: z.string().regex(/^STORY-\d+$/),
    }),
    handler: async (args, ctx) => {
      const item = findById(ctx.rootDir, args.id);
      if (!item) throw new Error(`Story not found: ${args.id}`);
      setPicked(ctx.rootDir, args.id);
      return { picked: args.id };
    },
  });

  registerTool({
    name: 'unpick',
    description: 'Clear the picked-story flag. Does not change any item\'s status.',
    inputSchema: z.object({}),
    handler: async (_args, ctx) => {
      clearPicked(ctx.rootDir);
      return { picked: null };
    },
  });
}
