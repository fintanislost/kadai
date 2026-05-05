import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { writeFileAtomic } from './files';
import { parseId } from './ids';

const PICKED_FILE = '.picked';

function pickedPath(rootDir: string): string {
  return join(rootDir, '.kadai', PICKED_FILE);
}

export function readPicked(rootDir: string): string | null {
  const path = pickedPath(rootDir);
  if (!existsSync(path)) return null;
  const v = readFileSync(path, 'utf8').trim();
  return v.length === 0 ? null : v;
}

export function setPicked(rootDir: string, storyId: string): void {
  const parsed = parseId(storyId);
  if (!parsed || parsed.kind !== 'story') {
    throw new Error(`Only stories can be picked (got ${storyId})`);
  }
  writeFileAtomic(pickedPath(rootDir), storyId);
}

export function clearPicked(rootDir: string): void {
  const path = pickedPath(rootDir);
  if (existsSync(path)) unlinkSync(path);
}
