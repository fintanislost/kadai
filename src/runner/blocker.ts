import { readFileSync } from 'node:fs';
import matter from 'gray-matter';
import { findById } from '../core/spine';
import { writeFileAtomic } from '../core/files';
import type { Blocker } from './types';

function serializeFrontmatterValue(v: unknown): string {
  if (Array.isArray(v)) return `[${v.join(', ')}]`;
  // gray-matter parses unquoted YAML dates (created: 2026-01-01) into JS Date
  // objects. The default toString() of a Date is a localized timezoned string
  // ("Wed Dec 31 2025 19:00:00 GMT-0500 ..."), which silently corrupts the
  // file across rewrites. Normalize Date back to ISO date string instead.
  if (v instanceof Date) return v.toISOString().split('T')[0];
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v);
}

export function recordDependencyEdge(rootDir: string, blockedStoryId: string, dependsOnId: string): void {
  const item = findById(rootDir, blockedStoryId);
  if (!item) throw new Error(`recordDependencyEdge: story ${blockedStoryId} not found`);
  const raw = readFileSync(item.path, 'utf8');
  const parsed = matter(raw);
  // gray-matter caches parsed.data by source bytes. Mutating it poisons the
  // cache for any later parse of the same content (cross-test contamination,
  // and in production a re-read of the same file would hit the cache too).
  // Always build a fresh object instead of mutating parsed.data in place.
  const sourceData = parsed.data as Record<string, unknown> & { dependsOn?: string[] };
  const existing = Array.isArray(sourceData.dependsOn) ? sourceData.dependsOn : [];
  // Case-insensitive dedupe so FEAT-009 vs feat-009 don't both land in the array.
  const normalizedNew = dependsOnId.toUpperCase();
  if (existing.some(id => id.toUpperCase() === normalizedNew)) return;
  const newData: Record<string, unknown> = { ...sourceData, dependsOn: [...existing, dependsOnId] };
  // Manual stringify so we control the format (gray-matter's default uses YAML
  // flow style which would break our [a, b] expectation).
  const newFrontmatter = Object.entries(newData)
    .map(([k, v]) => `${k}: ${serializeFrontmatterValue(v)}`)
    .join('\n');
  writeFileAtomic(item.path, `---\n${newFrontmatter}\n---\n${parsed.content}`);
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
