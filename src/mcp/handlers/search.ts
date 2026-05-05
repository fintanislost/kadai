import { z } from 'zod';
import { walkSpine } from '../../core/spine';
import { registerTool } from '../registry';
import type { Item } from '../../core/types';

function matches(item: Item, q: string): boolean {
  const lq = q.toLowerCase();
  if (item.data.title.toLowerCase().includes(lq)) return true;
  if (item.body.toLowerCase().includes(lq)) return true;
  const ac = (item.data as { acceptance_criteria?: string[] }).acceptance_criteria;
  if (ac && ac.some(c => c.toLowerCase().includes(lq))) return true;
  return false;
}

export function registerSearchTools(): void {
  registerTool({
    name: 'search',
    description: 'Full-text search across the spine. Matches against item title, body content, and acceptance criteria. Case-insensitive substring match.',
    inputSchema: z.object({
      query: z.string().min(1),
    }),
    handler: async (args, ctx) => {
      return walkSpine(ctx.rootDir).filter(item => matches(item, args.query));
    },
  });
}
