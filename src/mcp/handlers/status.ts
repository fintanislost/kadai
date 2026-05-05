import { z } from 'zod';
import { setStatus } from '../../core/operations';
import { findById } from '../../core/spine';
import { writeFileAtomic } from '../../core/files';
import { serialize } from '../../core/frontmatter';
import { registerTool } from '../registry';

const STATUS_VALUES = [
  'backlog', 'ready', 'in_progress', 'blocked', 'review', 'done', 'cancelled',
] as const;

export function registerStatusTools(): void {
  registerTool({
    name: 'set_status',
    description: 'Update the status of any item. Validates against the state machine; illegal transitions return an error. The optional reason field is recorded for audit but is not written to the item.',
    inputSchema: z.object({
      id: z.string().regex(/^(EPIC|FEAT|STORY|TASK)-\d+$/),
      status: z.enum(STATUS_VALUES),
      reason: z.string().optional(),
    }),
    handler: async (args, ctx) => {
      setStatus(ctx.rootDir, args.id, args.status);
      return { id: args.id, status: args.status };
    },
  });

  registerTool({
    name: 'set_phase',
    description: 'Move an epic, feature, or story to a different phase, optionally setting a new order within that phase. Tasks inherit phase from their story; calling on a task is an error.',
    inputSchema: z.object({
      id: z.string().regex(/^(EPIC|FEAT|STORY|TASK)-\d+$/),
      phase: z.string().min(1),
      order: z.number().int().min(0).optional(),
    }),
    handler: async (args, ctx) => {
      const item = findById(ctx.rootDir, args.id);
      if (!item) throw new Error(`Item not found: ${args.id}`);
      if (item.kind === 'task') {
        throw new Error('Tasks inherit phase from their story; cannot set phase on a task.');
      }
      const updated: Record<string, unknown> = {
        ...item.data,
        phase: args.phase,
        updated: new Date().toISOString().slice(0, 10),
      };
      if (typeof args.order === 'number') updated.order = args.order;
      writeFileAtomic(item.path, serialize(updated, item.body));
      return { id: args.id, phase: args.phase, order: updated.order };
    },
  });
}
