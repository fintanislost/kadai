const SPACING = 10;

export interface Ordered {
  order: number;
}

export function nextOrder<T extends Ordered>(items: T[]): number {
  if (items.length === 0) return SPACING;
  const max = Math.max(...items.map(i => i.order));
  return max + SPACING;
}

export function orderAfter<T extends Ordered>(items: T[], targetOrder: number): number {
  const sorted = [...items].sort((a, b) => a.order - b.order);
  const idx = sorted.findIndex(i => i.order === targetOrder);
  if (idx === -1) throw new Error(`No item with order=${targetOrder}`);
  const next = sorted[idx + 1];
  if (!next) return targetOrder + SPACING;
  return Math.floor((targetOrder + next.order) / 2);
}

export function redensify<T extends Ordered>(items: T[]): T[] {
  return [...items]
    .sort((a, b) => a.order - b.order)
    .map((item, i) => ({ ...item, order: (i + 1) * SPACING }));
}

export function needsRedensify<T extends Ordered>(items: T[]): boolean {
  const sorted = [...items].sort((a, b) => a.order - b.order);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].order - sorted[i - 1].order < 2) return true;
  }
  return false;
}
