import { test, expect, beforeAll, afterAll } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit } from '../../src/cli/init';
import { runAdd } from '../../src/cli/add';
import { startServer, type ServerHandle } from '../../src/web/server';

let tmp: string;
let server: ServerHandle;

// These tests assume `bun run build:web && bun run scripts/embed-assets.ts`
// has run at some point. If embedded-assets.generated.ts is absent, the
// fallback path (filesystem dist/) is used — both are acceptable here as
// long as /index.html responds with the SPA.
beforeAll(async () => {
  tmp = mkdtempSync(join(tmpdir(), 'kadai-embed-'));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'Auth', phase: 'mvp' });
  server = await startServer({ rootDir: tmp, port: 0 });
});

afterAll(async () => {
  await server.stop();
  rmSync(tmp, { recursive: true, force: true });
});

const base = () => `http://localhost:${server.port}`;

test('GET / serves the SPA index.html (from embedded or filesystem)', async () => {
  const r = await fetch(`${base()}/`);
  expect(r.status).toBe(200);
  const html = await r.text();
  expect(html).toContain('<html');
  expect(html).toContain('<div id="root"');
});

test('GET /assets/index.js serves the bundled JS', async () => {
  const r = await fetch(`${base()}/assets/index.js`);
  expect(r.status).toBe(200);
  expect(r.headers.get('content-type')).toMatch(/javascript/);
  const body = await r.text();
  expect(body.length).toBeGreaterThan(1000);
});

test('GET /assets/index.css serves the bundled CSS', async () => {
  const r = await fetch(`${base()}/assets/index.css`);
  expect(r.status).toBe(200);
  expect(r.headers.get('content-type')).toMatch(/css/);
});

test('GET /unknown-route returns the SPA index.html (client-side router fallback)', async () => {
  const r = await fetch(`${base()}/some/spa/route`);
  expect(r.status).toBe(200);
  const html = await r.text();
  expect(html).toContain('<div id="root"');
});
