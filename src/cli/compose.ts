import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Command } from 'commander';
import { walkSpine, findById } from '../core/spine';
import { findKadaiRoot } from '../core/find-root';
import type { Item, AnyFrontmatter } from '../core/types';

function getParent(data: AnyFrontmatter): string | undefined {
  if ('parent' in data) return data.parent;
  return undefined;
}

export function composePlan(rootDir: string, id: string): string | null {
  const root = findById(rootDir, id);
  if (!root) return null;

  const all = walkSpine(rootDir);
  const stories: Item[] = [];

  // Collect all descendant stories (recursive parent walk).
  const collectStories = (parentId: string) => {
    for (const item of all) {
      if (getParent(item.data) !== parentId) continue;
      if (item.kind === 'story') {
        stories.push(item);
      } else {
        collectStories(item.data.id);
      }
    }
  };

  // If the root IS a story, include it directly.
  if (root.kind === 'story') {
    stories.push(root);
  } else {
    collectStories(root.data.id);
  }

  // Sort stories by ID for deterministic order.
  stories.sort((a, b) => a.data.id.localeCompare(b.data.id));

  const lines: string[] = [];
  lines.push(`# Composite plan — ${id}`);
  lines.push(`> **${root.data.title}** — generated ${new Date().toISOString()} from ${stories.length} story plan(s).`);
  lines.push('');

  for (const story of stories) {
    lines.push(`## ${story.data.id} — ${story.data.title}`);
    lines.push('');
    const planPath = join(dirname(story.path), 'plan.md');
    if (existsSync(planPath)) {
      lines.push(readFileSync(planPath, 'utf8').trim());
    } else {
      lines.push('_(no plan yet)_');
    }
    lines.push('');
  }

  return lines.join('\n');
}

export const composeCommand = new Command('compose')
  .description('Render all descendant story plans of an epic/feature/story as one composite document')
  .argument('<id>', 'epic, feature, or story ID to compose from')
  .option('--out <path>', 'write to file instead of stdout')
  .action((id: string, opts: { out?: string }) => {
    const root = findKadaiRoot(process.cwd());
    if (!root) { process.stderr.write('Not inside a kadai project\n'); process.exit(1); }
    const result = composePlan(root, id);
    if (result === null) { process.stderr.write(`No item with ID ${id}\n`); process.exit(2); }
    if (opts.out) {
      writeFileSync(opts.out, result, 'utf8');
      process.stdout.write(`wrote ${opts.out}\n`);
    } else {
      process.stdout.write(result + '\n');
    }
  });
