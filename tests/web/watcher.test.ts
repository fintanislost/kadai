import { test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventBus, startWatcher } from '../../src/web/events';

let tmp: string;
let stop: (() => void) | null = null;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'kadai-watch-'));
  mkdirSync(join(tmp, '.kadai', 'epics'), { recursive: true });
});
afterEach(() => {
  if (stop) { stop(); stop = null; }
  rmSync(tmp, { recursive: true, force: true });
});

function waitForEvent(bus: EventBus, timeoutMs = 1000): Promise<{ scope: string }> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout waiting for event')), timeoutMs);
    const unsub = bus.subscribe(e => {
      clearTimeout(t);
      unsub();
      resolve(e);
    });
  });
}

test('startWatcher fires a spine event when an epic file is written', async () => {
  const bus = new EventBus();
  stop = startWatcher(tmp, bus, { debounceMs: 30 });

  const epicPath = join(tmp, '.kadai', 'epics', 'EPIC-001-x', 'epic.md');
  mkdirSync(join(tmp, '.kadai', 'epics', 'EPIC-001-x'), { recursive: true });
  await new Promise(r => setTimeout(r, 50));
  writeFileSync(epicPath, '---\nid: EPIC-001\n---\n');

  const event = await waitForEvent(bus, 1500);
  expect(event.scope).toBe('spine');
});

test('startWatcher fires a picked event when .picked is written', async () => {
  const bus = new EventBus();
  stop = startWatcher(tmp, bus, { debounceMs: 30 });

  await new Promise(r => setTimeout(r, 50));
  writeFileSync(join(tmp, '.kadai', '.picked'), 'STORY-001');

  const event = await waitForEvent(bus, 1500);
  expect(event.scope).toBe('picked');
});

test('startWatcher debounces multiple writes into one event', async () => {
  const bus = new EventBus();
  stop = startWatcher(tmp, bus, { debounceMs: 50 });

  const events: string[] = [];
  bus.subscribe(e => events.push(e.scope));

  await new Promise(r => setTimeout(r, 50));
  for (let i = 0; i < 5; i++) {
    writeFileSync(join(tmp, '.kadai', `file-${i}.tmp`), 'x');
  }
  await new Promise(r => setTimeout(r, 200));

  expect(events.length).toBeGreaterThan(0);
  expect(events.length).toBeLessThanOrEqual(2);
});

test('startWatcher stop() prevents subsequent events', async () => {
  const bus = new EventBus();
  stop = startWatcher(tmp, bus, { debounceMs: 30 });

  await new Promise(r => setTimeout(r, 50));
  stop();
  stop = null;

  let fired = false;
  bus.subscribe(() => { fired = true; });
  writeFileSync(join(tmp, '.kadai', 'after-stop.tmp'), 'x');
  await new Promise(r => setTimeout(r, 150));

  expect(fired).toBe(false);
});

test('startWatcher fires events for files in deeply nested directories that exist at startup', async () => {
  // Mirror a realistic kadai layout: .kadai/epics/X/features/Y/stories/Z/story.md
  const deepDir = join(tmp, '.kadai', 'epics', 'EPIC-001-x', 'features', 'FEAT-001-y', 'stories', 'STORY-001-z');
  mkdirSync(deepDir, { recursive: true });
  const deepFile = join(deepDir, 'story.md');
  writeFileSync(deepFile, '---\nid: STORY-001\nstatus: ready\n---\n');

  // NOW start the watcher — the deep path already exists.
  const bus = new EventBus();
  stop = startWatcher(tmp, bus, { debounceMs: 30 });

  // Give inotify a moment to settle the registration on every existing subdir.
  await new Promise(r => setTimeout(r, 100));

  // Edit the deep file — this should fire a spine event.
  writeFileSync(deepFile, '---\nid: STORY-001\nstatus: in_progress\n---\n');

  const event = await waitForEvent(bus, 1500);
  expect(event.scope).toBe('spine');
});

test('startWatcher delivers each scope as a separate event when scopes differ within the window', async () => {
  const bus = new EventBus();
  stop = startWatcher(tmp, bus, { debounceMs: 50 });

  const events: string[] = [];
  bus.subscribe(e => events.push(e.scope));

  await new Promise(r => setTimeout(r, 50));
  // First a spine change…
  writeFileSync(join(tmp, '.kadai', 'note.tmp'), 'x');
  // …then a picked change before the spine debounce fires.
  await new Promise(r => setTimeout(r, 10));
  writeFileSync(join(tmp, '.kadai', '.picked'), 'STORY-001');
  // …and a config change.
  await new Promise(r => setTimeout(r, 60));
  writeFileSync(join(tmp, '.kadai', 'config.toml'), 'x');

  await new Promise(r => setTimeout(r, 200));

  expect(events).toContain('spine');
  expect(events).toContain('picked');
  expect(events).toContain('config');
});
