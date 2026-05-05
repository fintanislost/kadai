import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export function findKadaiRoot(startDir: string): string | null {
  let cur = resolve(startDir);
  while (true) {
    if (existsSync(join(cur, '.kadai'))) return cur;
    const parent = dirname(cur);
    if (parent === cur) return null;
    cur = parent;
  }
}
