import { z } from 'zod';
import type { ItemKind } from './state-machine';

const STATUS = z.enum([
  'backlog',
  'ready',
  'in_progress',
  'blocked',
  'review',
  'done',
  'cancelled',
]);

const baseFrontmatter = z.object({
  id: z.string().regex(/^(EPIC|FEAT|STORY|TASK)-\d+$/),
  title: z.string().min(1),
  status: STATUS,
  created: z.string(),
  updated: z.string(),
});

const orderedFrontmatter = baseFrontmatter.extend({
  phase: z.string().min(1),
  order: z.number().int().min(0),
});

export const epicSchema = orderedFrontmatter.extend({
  id: z.string().regex(/^EPIC-\d+$/),
});

export const featureSchema = orderedFrontmatter.extend({
  id: z.string().regex(/^FEAT-\d+$/),
  parent: z.string().regex(/^EPIC-\d+$/),
  spec: z.string().optional(),
});

export const storySchema = orderedFrontmatter.extend({
  id: z.string().regex(/^STORY-\d+$/),
  parent: z.string().regex(/^FEAT-\d+$/),
  spec: z.string().optional(),
  plan: z.string().optional(),
  acceptance_criteria: z.array(z.string()).optional(),
});

export const taskSchema = baseFrontmatter.extend({
  id: z.string().regex(/^TASK-\d+$/),
  parent: z.string().regex(/^STORY-\d+$/),
  plan_step: z.number().int().min(1).optional(),
});

const SCHEMAS = {
  epic: epicSchema,
  feature: featureSchema,
  story: storySchema,
  task: taskSchema,
} as const;

export function validateFrontmatter(kind: ItemKind, data: unknown) {
  return SCHEMAS[kind].parse(data);
}

export function safeValidateFrontmatter(kind: ItemKind, data: unknown) {
  return SCHEMAS[kind].safeParse(data);
}
