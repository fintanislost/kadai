import { findById } from './spine';
import { isLegalTransition, type Status } from './state-machine';
import { writeFileAtomic } from './files';
import { serialize } from './frontmatter';

export function setStatus(rootDir: string, id: string, newStatus: Status): void {
  const item = findById(rootDir, id);
  if (!item) throw new Error(`Item not found: ${id}`);
  if (!isLegalTransition(item.kind, item.data.status, newStatus)) {
    throw new Error(
      `Illegal transition for ${id} (${item.kind}): ${item.data.status} → ${newStatus}`,
    );
  }
  const updated = {
    ...item.data,
    status: newStatus,
    updated: new Date().toISOString().slice(0, 10),
  };
  writeFileAtomic(item.path, serialize(updated as Record<string, unknown>, item.body));
}
