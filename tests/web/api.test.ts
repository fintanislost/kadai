import { test, expect, beforeAll, afterAll } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit } from '../../src/cli/init';
import { runAdd } from '../../src/cli/add';
import { setPicked } from '../../src/core/picked';
import { startServer, type ServerHandle } from '../../src/web/server';
import { setDisabled, clearDisabled } from '../../src/core/toggle';

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

test('POST /api/items/FEAT-001/attach uploads a spec.md', async () => {
  const form = new FormData();
  form.append('kind', 'spec');
  form.append('file', new Blob(['# Spec content\n'], { type: 'text/markdown' }), 'spec.md');

  const r = await fetch(`${base()}/api/items/FEAT-001/attach`, {
    method: 'POST',
    body: form,
  });
  expect(r.status).toBe(200);
  const json = await r.json();
  expect((json.data as any).spec).toBe('spec.md');

  const fr = await fetch(`${base()}/api/files/FEAT-001/spec.md`);
  expect(fr.status).toBe(200);
  expect(await fr.text()).toBe('# Spec content\n');
});

test('POST /api/items/STORY-001/attach uploads a plan.md', async () => {
  const form = new FormData();
  form.append('kind', 'plan');
  form.append('file', new Blob(['# Plan\n- step 1\n'], { type: 'text/markdown' }), 'plan.md');

  const r = await fetch(`${base()}/api/items/STORY-001/attach`, {
    method: 'POST',
    body: form,
  });
  expect(r.status).toBe(200);
  expect((((await r.json()) as any).data as any).plan).toBe('plan.md');
});

test('POST /api/items/EPIC-001/attach with kind=plan returns 400', async () => {
  const form = new FormData();
  form.append('kind', 'plan');
  form.append('file', new Blob(['x'], { type: 'text/markdown' }), 'plan.md');

  const r = await fetch(`${base()}/api/items/EPIC-001/attach`, {
    method: 'POST',
    body: form,
  });
  expect(r.status).toBe(400);
  const json = await r.json();
  expect(json.error).toMatch(/cannot attach/i);
});

test('POST /api/items/:id/attach with no file returns 400', async () => {
  const form = new FormData();
  form.append('kind', 'spec');

  const r = await fetch(`${base()}/api/items/FEAT-001/attach`, {
    method: 'POST',
    body: form,
  });
  expect(r.status).toBe(400);
  const json = await r.json();
  expect(json.error).toMatch(/file/i);
});

test('POST /api/items/:id/attach with bad kind returns 400', async () => {
  const form = new FormData();
  form.append('kind', 'changelog');
  form.append('file', new Blob(['x']), 'spec.md');

  const r = await fetch(`${base()}/api/items/FEAT-001/attach`, {
    method: 'POST',
    body: form,
  });
  expect(r.status).toBe(400);
});

test('GET /api/search?q=Auth returns matching items', async () => {
  const r = await fetch(`${base()}/api/search?q=Auth`);
  expect(r.status).toBe(200);
  const json = await r.json();
  expect(Array.isArray(json)).toBe(true);
  expect(json.length).toBeGreaterThanOrEqual(1);
  expect(json[0].id).toBe('EPIC-001');
  expect(json[0].matchType).toBe('title');
  expect(json[0].snippet).toContain('Auth');
});

test('GET /api/search?q=a returns empty list (under min query length)', async () => {
  const r = await fetch(`${base()}/api/search?q=a`);
  expect(r.status).toBe(200);
  expect(await r.json()).toEqual([]);
});

test('GET /api/search?q= returns empty list (empty string)', async () => {
  const r = await fetch(`${base()}/api/search?q=`);
  expect(r.status).toBe(200);
  expect(await r.json()).toEqual([]);
});

test('GET /api/search with no q parameter returns 400', async () => {
  const r = await fetch(`${base()}/api/search`);
  expect(r.status).toBe(400);
  const json = await r.json();
  expect(json.error).toMatch(/q/i);
});

test('GET /api/activity returns an empty list when no changelogs exist', async () => {
  const r = await fetch(`${base()}/api/activity`);
  expect(r.status).toBe(200);
  const json = await r.json();
  expect(Array.isArray(json)).toBe(true);
});

test('GET /api/activity?limit=10 caps the result count', async () => {
  const r = await fetch(`${base()}/api/activity?limit=10`);
  expect(r.status).toBe(200);
  const json = await r.json();
  expect(json.length).toBeLessThanOrEqual(10);
});

test('GET /api/compare?a=mvp&b=v1 returns the comparison shape', async () => {
  const r = await fetch(`${base()}/api/compare?a=mvp&b=v1`);
  expect(r.status).toBe(200);
  const json = await r.json();
  expect(json.a.phase).toBe('mvp');
  expect(json.b.phase).toBe('v1');
  expect(Array.isArray(json.common.titles)).toBe(true);
});

test('GET /api/compare with missing a or b returns 400', async () => {
  const r = await fetch(`${base()}/api/compare?a=mvp`);
  expect(r.status).toBe(400);
});

test('GET /api/compare with non-existent phase returns 404', async () => {
  const r = await fetch(`${base()}/api/compare?a=mvp&b=nope`);
  expect(r.status).toBe(404);
});

test('GET /api/items/:id/subtree returns the item + all descendants flat', async () => {
  const r = await fetch(`${base()}/api/items/EPIC-001/subtree`);
  expect(r.status).toBe(200);
  const json = await r.json();
  expect(Array.isArray(json)).toBe(true);
  // EPIC-001 + FEAT-001 + STORY-001 = 3 items in the seed.
  expect(json.length).toBeGreaterThanOrEqual(3);
  const ids = json.map((i: { data: { id: string } }) => i.data.id).sort();
  expect(ids).toContain('EPIC-001');
  expect(ids).toContain('FEAT-001');
  expect(ids).toContain('STORY-001');
});

test('GET /api/items/STORY-001/subtree returns just the story (and any tasks)', async () => {
  const r = await fetch(`${base()}/api/items/STORY-001/subtree`);
  expect(r.status).toBe(200);
  const json = await r.json();
  expect(json.length).toBeGreaterThanOrEqual(1);
  const ids = json.map((i: { data: { id: string } }) => i.data.id);
  expect(ids).toContain('STORY-001');
});

test('GET /api/items/EPIC-999/subtree returns 404 for unknown root', async () => {
  const r = await fetch(`${base()}/api/items/EPIC-999/subtree`);
  expect(r.status).toBe(404);
});

test('GET /api/disabled-status returns disabled:false when no disabled flag', async () => {
  const r = await fetch(`${base()}/api/disabled-status`);
  expect(r.status).toBe(200);
  const json = await r.json();
  expect(json.disabled).toBe(false);
});

test('GET /api/disabled-status returns disabled:true with since + reason when disabled', async () => {
  setDisabled(tmp, 'test');
  try {
    const r = await fetch(`${base()}/api/disabled-status`);
    const json = await r.json();
    expect(json.disabled).toBe(true);
    expect(json.since).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(json.reason).toBe('test');
  } finally {
    clearDisabled(tmp);
  }
});
