import { readFileSync, writeFileSync } from 'node:fs';
import matter from 'gray-matter';
import { findById } from '../core/spine';
import type { Blocker } from './types';

export function recordDependencyEdge(rootDir: string, blockedStoryId: string, dependsOnId: string): void {
  const item = findById(rootDir, blockedStoryId);
  if (!item) throw new Error(`recordDependencyEdge: story ${blockedStoryId} not found`);
  const raw = readFileSync(item.path, 'utf8');
  const parsed = matter(raw);
  const data = parsed.data as { dependsOn?: string[] };
  const existing = Array.isArray(data.dependsOn) ? data.dependsOn : [];
  if (existing.includes(dependsOnId)) return;  // idempotent
  data.dependsOn = [...existing, dependsOnId];
  // Manual stringify so we control the format (gray-matter's default uses YAML which would break our [a, b] expectation).
  const newFrontmatter = Object.entries(data).map(([k, v]) => {
    if (Array.isArray(v)) return `${k}: [${v.join(', ')}]`;
    return `${k}: ${v}`;
  }).join('\n');
  writeFileSync(item.path, `---\n${newFrontmatter}\n---\n${parsed.content}`, 'utf8');
}

export interface BlockerContext {
  storyId: string;
  taskTitle: string;
  blocker: Blocker;
}

export function formatBlockerPrompt(ctx: BlockerContext): string {
  if (ctx.blocker.kind === 'needs-feature') {
    const title = ctx.blocker.suggestedTitle ?? '(unnamed)';
    return [
      `${ctx.storyId} hit a blocker on ${ctx.taskTitle}.`,
      ``,
      `The implementer believes a fast-follow-up feature is needed:`,
      `  Title: ${title}`,
      `  Why:   ${ctx.blocker.description}`,
      ``,
      `Plan it now and resume after? [Y/n/skip]`,
    ].join('\n');
  }
  return [
    `${ctx.storyId} hit a blocker on ${ctx.taskTitle}.`,
    ``,
    `Reason: ${ctx.blocker.reason}`,
    ``,
    `The runner is paused. Resolve manually, then \`kadai run --resume\`.`,
  ].join('\n');
}
