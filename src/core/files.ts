import { writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomBytes } from 'node:crypto';

export function writeFileAtomic(path: string, contents: string | Buffer): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = join(dirname(path), `.${randomBytes(8).toString('hex')}.tmp`);
  writeFileSync(tmp, contents);
  renameSync(tmp, path);
}
