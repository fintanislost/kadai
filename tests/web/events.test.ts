import { test, expect } from 'bun:test';
import { EventBus, inferScope } from '../../src/web/events';

test('EventBus.subscribe receives subsequent notify calls', () => {
  const bus = new EventBus();
  const events: string[] = [];
  bus.subscribe(e => events.push(e.scope));
  bus.notify('spine');
  bus.notify('picked');
  expect(events).toEqual(['spine', 'picked']);
});

test('EventBus unsubscribe stops delivery', () => {
  const bus = new EventBus();
  const events: string[] = [];
  const unsub = bus.subscribe(e => events.push(e.scope));
  bus.notify('spine');
  unsub();
  bus.notify('config');
  expect(events).toEqual(['spine']);
});

test('EventBus delivers to multiple subscribers', () => {
  const bus = new EventBus();
  const a: string[] = [];
  const b: string[] = [];
  bus.subscribe(e => a.push(e.scope));
  bus.subscribe(e => b.push(e.scope));
  bus.notify('spine');
  expect(a).toEqual(['spine']);
  expect(b).toEqual(['spine']);
});

test('EventBus listener exception does not break other listeners', () => {
  const bus = new EventBus();
  const ok: string[] = [];
  bus.subscribe(() => { throw new Error('boom'); });
  bus.subscribe(e => ok.push(e.scope));
  expect(() => bus.notify('spine')).not.toThrow();
  expect(ok).toEqual(['spine']);
});

test('inferScope: .picked file → picked', () => {
  expect(inferScope('.picked')).toBe('picked');
  expect(inferScope('/abs/path/.kadai/.picked')).toBe('picked');
});

test('inferScope: config.toml → config', () => {
  expect(inferScope('config.toml')).toBe('config');
  expect(inferScope('/abs/path/.kadai/config.toml')).toBe('config');
});

test('inferScope: anything else → spine', () => {
  expect(inferScope('epics/EPIC-001-x/epic.md')).toBe('spine');
  expect(inferScope('epics/EPIC-001-x/features/FEAT-001-y/feature.md')).toBe('spine');
  expect(inferScope('.counters.json')).toBe('spine');
});
