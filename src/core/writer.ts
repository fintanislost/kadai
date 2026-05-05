import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { writeFileAtomic } from './files';
import { serialize } from './frontmatter';
import { slugify } from './slug';
import { validateFrontmatter } from './schema';
import type { ItemKind } from './state-machine';
import type { AnyFrontmatter } from './types';

export interface WriteContext {
  rootDir: string;
  parentPath?: string;
}

const FILENAMES: Record<Exclude<ItemKind, 'task'>, string> = {
  epic: 'epic.md',
  feature: 'feature.md',
  story: 'story.md',
};

function computeItemDir(kind: ItemKind, id: string, title: string, ctx: WriteContext): string {
  const slug = slugify(title);
  const dirName = `${id}-${slug}`;
  if (kind === 'epic') {
    return join(ctx.rootDir, '.kadai', 'epics', dirName);
  }
  if (!ctx.parentPath) throw new Error(`${kind} requires parentPath`);
  if (kind === 'feature') return join(ctx.parentPath, 'features', dirName);
  if (kind === 'story') return join(ctx.parentPath, 'stories', dirName);
  if (kind === 'task') return join(ctx.parentPath, 'tasks');
  throw new Error(`Unknown kind: ${kind}`);
}

export function writeItem(
  kind: ItemKind,
  data: AnyFrontmatter,
  body: string,
  ctx: WriteContext,
): string {
  const validated = validateFrontmatter(kind, data) as AnyFrontmatter;
  const itemDir = computeItemDir(kind, validated.id, validated.title, ctx);
  mkdirSync(itemDir, { recursive: true });

  let filename: string;
  if (kind === 'task') {
    const slug = slugify(validated.title);
    filename = `${validated.id}-${slug}.md`;
  } else {
    filename = FILENAMES[kind];
  }

  const filePath = join(itemDir, filename);
  const content = serialize(validated as Record<string, unknown>, body);
  writeFileAtomic(filePath, content);
  return filePath;
}
