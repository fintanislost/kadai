import { test, expect, beforeAll, afterAll } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit } from '../../src/cli/init';
import { runAdd } from '../../src/cli/add';
import { startServer, type ServerHandle } from '../../src/web/server';
import { EventBus } from '../../src/web/events';

let tmp: string;
let server: ServerHandle;
let bus: EventBus;

beforeAll(async () => {
  tmp = mkdtempSync(join(tmpdir(), 'kadai-sse-'));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'Auth', phase: 'mvp' });

  bus = new EventBus();
  server = await startServer({ rootDir: tmp, port: 0, eventBus: bus, startWatcher: false });
});

afterAll(async () => {
  await server.stop();
  rmSync(tmp, { recursive: true, force: true });
});

test('GET /api/events returns text/event-stream content type', async () => {
  const r = await fetch(`http://localhost:${server.port}/api/events`);
  expect(r.status).toBe(200);
  expect(r.headers.get('content-type')).toMatch(/text\/event-stream/);
  // Cancel the stream so the test exits cleanly.
  await r.body!.cancel();
});

test('GET /api/events delivers a notify() to a connected client', async () => {
  const r = await fetch(`http://localhost:${server.port}/api/events`);
  const reader = r.body!.getReader();
  const decoder = new TextDecoder();

  // Fire an event after the connection is open.
  setTimeout(() => bus.notify('spine'), 50);

  // Read chunks until we see a `data:` line; bail after 2 seconds.
  const start = Date.now();
  let buffer = '';
  while (Date.now() - start < 2000) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    if (buffer.includes('data:')) break;
  }
  await reader.cancel();

  expect(buffer).toMatch(/data: \{"scope":"spine"\}/);
});
