export type ChangeScope = 'spine' | 'picked' | 'config';

export interface ChangeEvent {
  scope: ChangeScope;
}

export type ChangeListener = (event: ChangeEvent) => void;

export class EventBus {
  private listeners = new Set<ChangeListener>();

  subscribe(fn: ChangeListener): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  notify(scope: ChangeScope): void {
    const event: ChangeEvent = { scope };
    for (const fn of this.listeners) {
      try { fn(event); } catch { /* swallow listener errors */ }
    }
  }
}

export function inferScope(path: string): ChangeScope {
  if (path.endsWith('.picked')) return 'picked';
  if (path.endsWith('config.toml')) return 'config';
  return 'spine';
}
