import { z } from 'zod';
import { walkSpine } from '../../core/spine';
import { loadConfig } from '../../config/load';
import { registerTool } from '../registry';
import type { Item } from '../../core/types';
import type { ItemKind, Status } from '../../core/state-machine';

const STATUS_VALUES = [
  'backlog', 'ready', 'in_progress', 'blocked', 'review', 'done', 'cancelled',
] as const;

function filterItems(
  items: Item[],
  kind: ItemKind,
  filters: { phase?: string; status?: Status; parent?: string },
): Item[] {
  return items.filter(item => {
    if (item.kind !== kind) return false;
    const d = item.data as unknown as Record<string, unknown>;
    if (filters.phase && d.phase !== filters.phase) return false;
    if (filters.status && item.data.status !== filters.status) return false;
    if (filters.parent && d.parent !== filters.parent) return false;
    return true;
  });
}

export function registerReadTools(): void {
  registerTool({
    name: 'list_phases',
    description: 'List all configured phases (slug, display name, color). Phases are the scope tiers (e.g. mvp, v1, future) that epics/features/stories belong to.',
    inputSchema: z.object({}),
    handler: async (_args, ctx) => {
      return loadConfig(ctx.rootDir).phases;
    },
  });

  registerTool({
    name: 'list_epics',
    description: 'List epics in the spine, optionally filtered by phase and/or status.',
    inputSchema: z.object({
      phase: z.string().optional(),
      status: z.enum(STATUS_VALUES).optional(),
    }),
    handler: async (args, ctx) => {
      return filterItems(walkSpine(ctx.rootDir), 'epic', args);
    },
  });

  registerTool({
    name: 'list_features',
    description: 'List features, optionally filtered by epic_id (parent), phase, and/or status.',
    inputSchema: z.object({
      epic_id: z.string().regex(/^EPIC-\d+$/).optional(),
      phase: z.string().optional(),
      status: z.enum(STATUS_VALUES).optional(),
    }),
    handler: async (args, ctx) => {
      return filterItems(walkSpine(ctx.rootDir), 'feature', {
        phase: args.phase,
        status: args.status,
        parent: args.epic_id,
      });
    },
  });

  registerTool({
    name: 'list_stories',
    description: 'List stories, optionally filtered by feature_id (parent), phase, and/or status.',
    inputSchema: z.object({
      feature_id: z.string().regex(/^FEAT-\d+$/).optional(),
      phase: z.string().optional(),
      status: z.enum(STATUS_VALUES).optional(),
    }),
    handler: async (args, ctx) => {
      return filterItems(walkSpine(ctx.rootDir), 'story', {
        phase: args.phase,
        status: args.status,
        parent: args.feature_id,
      });
    },
  });

  registerTool({
    name: 'list_tasks',
    description: 'List tasks, optionally filtered by story_id (parent) and/or status.',
    inputSchema: z.object({
      story_id: z.string().regex(/^STORY-\d+$/).optional(),
      status: z.enum(STATUS_VALUES).optional(),
    }),
    handler: async (args, ctx) => {
      return filterItems(walkSpine(ctx.rootDir), 'task', {
        status: args.status,
        parent: args.story_id,
      });
    },
  });
}
