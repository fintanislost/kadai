import { readFileSync } from 'node:fs';
import { parseId } from './ids';
import { parse } from './frontmatter';
import { validateFrontmatter } from './schema';
import type { Item, AnyFrontmatter } from './types';

function normalizeFrontmatter(data: Record<string, unknown>): Record<string, unknown> {
  const result = { ...data };
  if (result.created instanceof Date) {
    result.created = result.created.toISOString().split('T')[0];
  }
  if (result.updated instanceof Date) {
    result.updated = result.updated.toISOString().split('T')[0];
  }
  return result;
}

export function readItem(path: string): Item {
  const source = readFileSync(path, 'utf8');
  const { data, body } = parse(source);
  const normalized = normalizeFrontmatter(data as Record<string, unknown>);
  const id = (normalized as { id?: string }).id;
  if (!id) throw new Error(`Missing id in frontmatter at ${path}`);
  const parsed = parseId(id);
  if (!parsed) throw new Error(`Invalid id "${id}" at ${path}`);
  const validated = validateFrontmatter(parsed.kind, normalized) as AnyFrontmatter;
  return {
    kind: parsed.kind,
    path,
    data: validated,
    body,
  };
}
