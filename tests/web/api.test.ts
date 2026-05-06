import { test, expect, beforeAll, afterAll } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit } from '../../src/cli/init';
import { runAdd } from '../../src/cli/add';
import { setPicked } from '../../src/core/picked';
import { startServer, type ServerHandle } from '../../src/web/server';

let tmp: string;
let server: ServerHandle;

beforeAll(async () => {
  tmp = mkdtempSync(join(tmpdir(), 'kadai-web-api-'));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'Auth', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'feature', title: 'Login', phase: 'mvp', parent: 'EPIC-001' });
  runAdd({ rootDir: tmp, kind: 'story', title: 'Email', phase: 'mvp', parent: 'FEAT-001' });
  server = await startServer({ rootDir: tmp, port: 0 });
});

afterAll(async () => {
  await server.stop();
  rmSync(tmp, { recursive: true, force: true });
});

const base = () => `http://localhost:${server.port}`;

test('GET /api/phases returns the configured phases', async () => {
  const r = await fetch(`${base()}/api/phases`);
  expect(r.status).toBe(200);
  const json = await r.json();
  expect(json.map((p: any) => p.slug)).toContain('mvp');
});

test('GET /api/epics returns all epics with no filter', async () => {
  const r = await fetch(`${base()}/api/epics`);
  expect(r.status).toBe(200);
  const json = await r.json();
  expect(json.length).toBe(1);
  expect(json[0].data.id).toBe('EPIC-001');
});

test('GET /api/features?epic_id=EPIC-001 filters by parent epic', async () => {
  const r = await fetch(`${base()}/api/features?epic_id=EPIC-001`);
  expect(r.status).toBe(200);
  const json = await r.json();
  expect(json.length).toBe(1);
});

test('GET /api/items/EPIC-001 returns the item', async () => {
  const r = await fetch(`${base()}/api/items/EPIC-001`);
  expect(r.status).toBe(200);
  const json = await r.json();
  expect(json.data.title).toBe('Auth');
});

test('GET /api/items/MISSING returns 404', async () => {
  const r = await fetch(`${base()}/api/items/EPIC-999`);
  expect(r.status).toBe(404);
});

test('GET /api/picked returns null when nothing picked', async () => {
  const r = await fetch(`${base()}/api/picked`);
  expect(r.status).toBe(200);
  const json = await r.json();
  expect(json).toBeNull();
});

test('GET /api/picked returns the picked story', async () => {
  setPicked(tmp, 'STORY-001');
  const r = await fetch(`${base()}/api/picked`);
  const json = await r.json();
  expect(json?.data?.id).toBe('STORY-001');
});

test('GET /api/items/EPIC-001/transitions returns legal next states', async () => {
  const r = await fetch(`${base()}/api/items/EPIC-001/transitions`);
  expect(r.status).toBe(200);
  const json = await r.json();
  expect(json.current).toBe('ready');
  expect(json.allowed).toContain('in_progress');
});

test('GET /api/items/MISSING/transitions returns 404', async () => {
  const r = await fetch(`${base()}/api/items/EPIC-999/transitions`);
  expect(r.status).toBe(404);
});

test('POST /api/items/:id/status moves a legal transition', async () => {
  const r = await fetch(`${base()}/api/items/STORY-001/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'in_progress' }),
  });
  expect(r.status).toBe(200);
  const json = await r.json();
  expect(json.data.status).toBe('in_progress');

  // Reset for downstream tests:
  await fetch(`${base()}/api/items/STORY-001/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'review' }),
  });
  await fetch(`${base()}/api/items/STORY-001/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'in_progress' }),
  });
});

test('POST /api/items/:id/status rejects an illegal transition with 400', async () => {
  const r = await fetch(`${base()}/api/items/EPIC-001/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'done' }),
  });
  expect(r.status).toBe(400);
  const json = await r.json();
  expect(json.error).toMatch(/illegal transition/i);
});

test('POST /api/items/:id/status returns 404 for unknown ID', async () => {
  const r = await fetch(`${base()}/api/items/EPIC-999/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'in_progress' }),
  });
  expect(r.status).toBe(404);
});

test('POST /api/items/:id/status returns 400 for missing body', async () => {
  const r = await fetch(`${base()}/api/items/EPIC-001/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  expect(r.status).toBe(400);
  const json = await r.json();
  expect(json.error).toMatch(/status/i);
});
