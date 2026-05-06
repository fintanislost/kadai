import { z } from 'zod';
import { searchSpine } from '../../core/search';
import { findById } from '../../core/spine';
import { registerTool } from '../registry';
import type { Item } from '../../core/types';

export function registerSearchTools(): void {
  registerTool({
    name: 'search',
    description: 'Full-text search across the spine. Matches against item title, body content, and acceptance criteria. Case-insensitive substring match.',
    inputSchema: z.object({
      query: z.string().min(1),
    }),
    handler: async (args, ctx) => {
      const results = searchSpine(ctx.rootDir, args.query);
      // Preserve existing MCP contract: return full Items, not the new SearchResult shape.
      const items: Item[] = [];
      for (const r of results) {
        const item = findById(ctx.rootDir, r.id);
        if (item) items.push(item);
      }
      return items;
    },
  });
}
