import { watch, watchFile, unwatchFile, readdirSync, statSync, type FSWatcher } from 'node:fs';
import { join } from 'node:path';

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

export interface WatcherOptions {
  debounceMs?: number;
}

/**
 * Watch <rootDir>/.kadai recursively. On a change, debounce briefly (50ms by default),
 * infer the scope from the most recent path, and notify the bus. Returns a stop function.
 *
 * Implementation notes for Linux/Bun inotify:
 * - `fs.watch(dir, { recursive: true })` does not reliably fire events for files written
 *   directly inside the watched directory root (dotfiles silently dropped, new-subdir
 *   writes sometimes missed before the recursive watcher registers the new directory).
 * - We use a manual recursive approach: non-recursive fs.watch on kadaiDir itself and on
 *   each known subdirectory, dynamically adding watches for newly created subdirectories.
 * - `.picked` is a dotfile and is additionally monitored via watchFile() (stat polling)
 *   because non-recursive fs.watch on Linux also drops dotfile events in nested dirs.
 */
export function startWatcher(rootDir: string, bus: EventBus, opts: WatcherOptions = {}): () => void {
  const debounceMs = opts.debounceMs ?? 50;
  const kadaiDir = join(rootDir, '.kadai');

  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingScope: ChangeScope = 'spine';
  const watchers = new Map<string, FSWatcher>();

  function scheduleNotify(scope: ChangeScope): void {
    if (stopped) return;
    pendingScope = scope;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      if (!stopped) bus.notify(pendingScope);
      pendingScope = 'spine';
      timer = null;
    }, debounceMs);
  }

  function addDirWatch(dir: string): void {
    if (stopped || watchers.has(dir)) return;
    try {
      const w = watch(dir, (_eventType, filename) => {
        if (stopped) return;
        const name = filename ? String(filename) : '';
        scheduleNotify(inferScope(name));
        // If a new subdirectory was created, add a watcher on it.
        if (name) {
          const full = join(dir, name);
          try {
            if (statSync(full).isDirectory()) addDirWatch(full);
          } catch { /* entry may not exist yet */ }
        }
      });
      watchers.set(dir, w);
    } catch { /* directory may not exist */ }
  }

  // Watch kadaiDir root and all existing subdirectories recursively.
  function walkAndWatch(dir: string): void {
    addDirWatch(dir);
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return; }
    for (const entry of entries) {
      const full = join(dir, entry);
      try {
        if (statSync(full).isDirectory()) walkAndWatch(full);
      } catch { /* entry may have been removed concurrently */ }
    }
  }

  try {
    walkAndWatch(kadaiDir);
  } catch {
    // .kadai may not exist yet — return a noop stop so the caller doesn't crash.
    return () => {};
  }

  // `.picked` is a dotfile; non-recursive fs.watch on Linux silently drops dotfile events.
  // Use stat-based polling as a reliable fallback.
  const pickedPath = join(kadaiDir, '.picked');
  watchFile(pickedPath, { persistent: false, interval: 50 }, (curr, prev) => {
    if (curr.mtime.getTime() !== prev.mtime.getTime() || curr.size !== prev.size) {
      scheduleNotify('picked');
    }
  });

  return () => {
    stopped = true;
    if (timer) { clearTimeout(timer); timer = null; }
    for (const w of watchers.values()) w.close();
    watchers.clear();
    unwatchFile(pickedPath);
  };
}
