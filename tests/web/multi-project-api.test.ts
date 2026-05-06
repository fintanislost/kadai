import { test, expect, beforeAll, afterAll } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit } from '../../src/cli/init';
import { runAdd } from '../../src/cli/add';
import { startServer, type ServerHandle } from '../../src/web/server';
import { EventBus } from '../../src/web/events';

let projA: string;
let projB: string;
let server: ServerHandle;
let busA: EventBus;
let busB: EventBus;

beforeAll(async () => {
  projA = mkdtempSync(join(tmpdir(), 'kadai-mp-a-'));
  projB = mkdtempSync(join(tmpdir(), 'kadai-mp-b-'));

  runInit({ rootDir: projA, productDescription: 'Alpha', skipFirstEpic: true });
  runAdd({ rootDir: projA, kind: 'epic', title: 'Auth', phase: 'mvp' });

  runInit({ rootDir: projB, productDescription: 'Beta', skipFirstEpic: true });
  runAdd({ rootDir: projB, kind: 'epic', title: 'Billing', phase: 'mvp' });

  busA = new EventBus();
  busB = new EventBus();
  server = await startServer({
    rootDir: projA,
    port: 0,
    startWatcher: false,
    projects: [
      { slug: 'alpha', name: 'Alpha', rootDir: projA, eventBus: busA },
      { slug: 'beta', name: 'Beta', rootDir: projB, eventBus: busB },
    ],
  });
});

afterAll(async () => {
  await server.stop();
  rmSync(projA, { recursive: true, force: true });
  rmSync(projB, { recursive: true, force: true });
});

const base = () => `http://localhost:${server.port}`;

test('GET /api/projects lists all registered projects', async () => {
  const r = await fetch(`${base()}/api/projects`);
  expect(r.status).toBe(200);
  const json = await r.json();
  expect(json.map((p: { slug: string }) => p.slug).sort()).toEqual(['alpha', 'beta']);
});

test('GET /api/p/alpha/items/EPIC-001 returns alpha\'s epic', async () => {
  const r = await fetch(`${base()}/api/p/alpha/items/EPIC-001`);
  expect(r.status).toBe(200);
  const json = await r.json();
  expect(json.data.title).toBe('Auth');
});

test('GET /api/p/beta/items/EPIC-001 returns beta\'s (different) epic', async () => {
  const r = await fetch(`${base()}/api/p/beta/items/EPIC-001`);
  expect(r.status).toBe(200);
  const json = await r.json();
  expect(json.data.title).toBe('Billing');
});

test('GET /api/p/<unknown-slug>/items/X returns 404', async () => {
  const r = await fetch(`${base()}/api/p/does-not-exist/items/EPIC-001`);
  expect(r.status).toBe(404);
});

test('GET /api/p/alpha/events returns text/event-stream for alpha\'s bus', async () => {
  const r = await fetch(`${base()}/api/p/alpha/events`);
  expect(r.status).toBe(200);
  expect(r.headers.get('content-type')).toMatch(/text\/event-stream/);
  await r.body!.cancel();
});

test('In multi-project mode, the legacy /api/items/X route returns 404', async () => {
  const r = await fetch(`${base()}/api/items/EPIC-001`);
  expect(r.status).toBe(404);
});
