import { z } from 'zod';
import { runAdd } from '../../cli/add';
import { registerTool } from '../registry';

const titleField = z.string().min(1);
const phaseField = z.string().min(1);
const orderField = z.number().int().min(0).optional();
const descriptionField = z.string().default('');

function bodyFromDescription(desc: string): string {
  if (!desc.trim()) return '## Description\n\n_Add a description here._\n';
  return `## Description\n\n${desc}\n`;
}

export function registerCreateTools(): void {
  registerTool({
    name: 'create_epic',
    description: 'Create a new epic at the top level of the spine. Phase is required (e.g. "mvp"). Returns the new epic\'s ID.',
    inputSchema: z.object({
      title: titleField,
      phase: phaseField,
      order: orderField,
      description: descriptionField,
    }),
    handler: async (args, ctx) => {
      const id = runAdd({
        rootDir: ctx.rootDir,
        kind: 'epic',
        title: args.title,
        phase: args.phase,
        order: args.order,
        body: bodyFromDescription(args.description),
      });
      return { id };
    },
  });

  registerTool({
    name: 'create_feature',
    description: 'Create a new feature under a parent epic. Returns the new feature\'s ID.',
    inputSchema: z.object({
      parent_epic: z.string().regex(/^EPIC-\d+$/),
      title: titleField,
      phase: phaseField,
      order: orderField,
      description: descriptionField,
    }),
    handler: async (args, ctx) => {
      const id = runAdd({
        rootDir: ctx.rootDir,
        kind: 'feature',
        title: args.title,
        phase: args.phase,
        order: args.order,
        parent: args.parent_epic,
        body: bodyFromDescription(args.description),
      });
      return { id };
    },
  });

  registerTool({
    name: 'create_story',
    description: 'Create a new story under a parent feature. acceptance_criteria is an optional list of strings. Returns the new story\'s ID.',
    inputSchema: z.object({
      parent_feature: z.string().regex(/^FEAT-\d+$/),
      title: titleField,
      phase: phaseField,
      order: orderField,
      description: descriptionField,
      acceptance_criteria: z.array(z.string()).optional(),
    }),
    handler: async (args, ctx) => {
      const id = runAdd({
        rootDir: ctx.rootDir,
        kind: 'story',
        title: args.title,
        phase: args.phase,
        order: args.order,
        parent: args.parent_feature,
        body: bodyFromDescription(args.description),
        acceptance_criteria: args.acceptance_criteria,
      });
      return { id };
    },
  });

  registerTool({
    name: 'create_task',
    description: 'Create a new task under a parent story. plan_step is an optional integer referencing a step in the parent story\'s plan.md. Returns the new task\'s ID.',
    inputSchema: z.object({
      parent_story: z.string().regex(/^STORY-\d+$/),
      title: titleField,
      description: descriptionField,
      plan_step: z.number().int().min(1).optional(),
    }),
    handler: async (args, ctx) => {
      const id = runAdd({
        rootDir: ctx.rootDir,
        kind: 'task',
        title: args.title,
        parent: args.parent_story,
        body: bodyFromDescription(args.description),
        plan_step: args.plan_step,
      });
      return { id };
    },
  });
}
