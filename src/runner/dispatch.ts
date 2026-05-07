import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { findById } from '../core/spine';
import type { Blocker } from './types';

export type ImplementerOutcome =
  | { status: 'DONE' }
  | { status: 'DONE_WITH_CONCERNS'; concerns: string }
  | { status: 'BLOCKED'; reason: string }
  | { status: 'NEEDS_CONTEXT'; missing: string };

export type Dispatcher = (taskTitle: string, taskBody: string, storyContext: { id: string; title: string }) => Promise<ImplementerOutcome>;

export type StoryRunResult =
  | { kind: 'story-done'; completedTasks: number }
  | { kind: 'blocked'; blocker: Blocker; completedTasks: number; remainingTaskTitle: string }
  | { kind: 'needs-feature'; description: string; suggestedTitle?: string; completedTasks: number; remainingTaskTitle: string }
  | { kind: 'error'; message: string };

interface ParsedTask {
  title: string;
  body: string;
}

export function parseTasks(planMarkdown: string): ParsedTask[] {
  const lines = planMarkdown.split('\n');
  const tasks: ParsedTask[] = [];
  let current: ParsedTask | null = null;
  for (const line of lines) {
    const m = line.match(/^##\s+(Task\s+.+)$/);
    if (m) {
      if (current) tasks.push(current);
      current = { title: m[1].trim(), body: '' };
    } else if (current) {
      current.body += line + '\n';
    }
  }
  if (current) tasks.push(current);
  return tasks.map(t => ({ title: t.title, body: t.body.trim() }));
}

function parseBlocker(reason: string): Blocker {
  const m = reason.match(/^needs-feature:\s*(.+)$/i);
  if (m) {
    return { kind: 'needs-feature', description: m[1].trim() };
  }
  return { kind: 'generic', reason };
}

export async function runStory(rootDir: string, storyId: string, dispatcher: Dispatcher): Promise<StoryRunResult> {
  const story = findById(rootDir, storyId);
  if (!story) return { kind: 'error', message: `Story ${storyId} not found` };

  const planPath = join(dirname(story.path), 'plan.md');
  if (!existsSync(planPath)) return { kind: 'error', message: `Story ${storyId} has no plan.md` };

  const tasks = parseTasks(readFileSync(planPath, 'utf8'));
  const sd = story.data as { id: string; title: string };
  const ctx = { id: sd.id, title: sd.title };

  let completed = 0;
  for (const task of tasks) {
    const outcome = await dispatcher(task.title, task.body, ctx);
    if (outcome.status === 'DONE' || outcome.status === 'DONE_WITH_CONCERNS') {
      completed++;
      continue;
    }
    if (outcome.status === 'BLOCKED') {
      const blocker = parseBlocker(outcome.reason);
      if (blocker.kind === 'needs-feature') {
        return { kind: 'needs-feature', description: blocker.description, completedTasks: completed, remainingTaskTitle: task.title };
      }
      return { kind: 'blocked', blocker, completedTasks: completed, remainingTaskTitle: task.title };
    }
    if (outcome.status === 'NEEDS_CONTEXT') {
      return { kind: 'blocked', blocker: { kind: 'generic', reason: `needs context: ${outcome.missing}` }, completedTasks: completed, remainingTaskTitle: task.title };
    }
  }
  return { kind: 'story-done', completedTasks: completed };
}
