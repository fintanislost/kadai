import { copyFileSync, existsSync, unlinkSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { findById } from './spine';
import { writeFileAtomic } from './files';
import { serialize } from './frontmatter';

export type AttachKind = 'spec' | 'plan';

export interface AttachResult {
  itemId: string;
  kind: AttachKind;
  targetPath: string;
}

/**
 * Attach a markdown file to an item.
 * spec → allowed on feature and story; written as `spec.md`.
 * plan → allowed on story only; written as `plan.md`.
 * The source file is moved (copy + remove). The item's frontmatter is updated.
 */
export function attachFile(
  rootDir: string,
  itemId: string,
  kind: AttachKind,
  sourcePath: string,
): AttachResult {
  const item = findById(rootDir, itemId);
  if (!item) throw new Error(`Item not found: ${itemId}`);

  const allowed = kind === 'spec'
    ? (item.kind === 'feature' || item.kind === 'story')
    : (item.kind === 'story');
  if (!allowed) {
    throw new Error(`Cannot attach ${kind} to ${item.kind} (${itemId})`);
  }

  const src = isAbsolute(sourcePath) ? sourcePath : resolve(rootDir, sourcePath);
  if (!existsSync(src)) throw new Error(`Source file not found: ${src}`);

  const filename = kind === 'spec' ? 'spec.md' : 'plan.md';
  const itemDir = dirname(item.path);
  const target = join(itemDir, filename);

  copyFileSync(src, target);
  unlinkSync(src);

  const updated: Record<string, unknown> = {
    ...item.data,
    [kind]: filename,
    updated: new Date().toISOString().slice(0, 10),
  };
  writeFileAtomic(item.path, serialize(updated, item.body));

  return { itemId, kind, targetPath: target };
}
