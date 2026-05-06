import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, type ChildProcess } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../..');

let tmp: string;
let serverProcess: ChildProcess;
let serverUrl: string;

/** Spawn a small bun script that seeds the spine and starts the server, then prints its port. */
async function spawnServer(tmpDir: string): Promise<string> {
  const helperScript = join(tmpDir, '_helper.ts');
  writeFileSync(helperScript, `
import { runInit } from '${repoRoot}/src/cli/init';
import { runAdd } from '${repoRoot}/src/cli/add';
import { startServer } from '${repoRoot}/src/web/server';
import { resolve } from 'node:path';

const tmp = ${JSON.stringify(tmpDir)};
const distDir = resolve(${JSON.stringify(repoRoot)}, 'src/web/dist');

runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
runAdd({ rootDir: tmp, kind: 'epic', title: 'Authentication', phase: 'mvp' });
runAdd({ rootDir: tmp, kind: 'feature', title: 'Login', phase: 'mvp', parent: 'EPIC-001' });
runAdd({ rootDir: tmp, kind: 'story', title: 'Email login', phase: 'mvp', parent: 'FEAT-001' });
runAdd({ rootDir: tmp, kind: 'story', title: 'OAuth login', phase: 'mvp', parent: 'FEAT-001' });
runAdd({ rootDir: tmp, kind: 'story', title: 'Magic link', phase: 'mvp', parent: 'FEAT-001' });

const handle = await startServer({ rootDir: tmp, port: 0, distDir });
process.stdout.write('READY:' + handle.port + '\\n');

// Keep alive until parent closes stdin
process.stdin.resume();
process.stdin.on('close', async () => {
  await handle.stop();
  process.exit(0);
});
`);

  return new Promise((resolve, reject) => {
    const child = spawn('/usr/bin/bun', ['run', helperScript], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    serverProcess = child;

    let output = '';
    child.stdout!.on('data', (chunk: Buffer) => {
      output += chunk.toString();
      const match = output.match(/READY:(\d+)/);
      if (match) {
        resolve(`http://localhost:${match[1]}`);
      }
    });

    child.stderr!.on('data', (chunk: Buffer) => {
      // suppress but allow debug if needed
      process.stderr.write(chunk);
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        reject(new Error(`server process exited with code ${code}`));
      }
    });

    // Timeout if server doesn't start within 15s
    setTimeout(() => reject(new Error('Server did not start within 15s')), 15_000);
  });
}

test.beforeAll(async () => {
  tmp = mkdtempSync(join(tmpdir(), 'kadai-e2e-'));
  serverUrl = await spawnServer(tmp);
});

test.afterAll(async () => {
  // Close stdin to signal graceful shutdown, then kill after a moment
  if (serverProcess) {
    serverProcess.stdin?.end();
    await new Promise<void>((res) => setTimeout(res, 500));
    if (!serverProcess.killed) serverProcess.kill();
  }
  rmSync(tmp, { recursive: true, force: true });
});

test('roadmap home renders the seeded epic', async ({ page }) => {
  await page.goto(serverUrl);
  await page.waitForLoadState('load');
  await expect(page.locator('text=Authentication')).toBeVisible();
});

test('drilling into an epic shows its features', async ({ page }) => {
  await page.goto(serverUrl);
  await page.waitForLoadState('load');
  await page.locator('text=Authentication').click();
  await expect(page.locator('text=Login')).toBeVisible();
});

test('drilling into a story shows the tabs', async ({ page }) => {
  await page.goto(`${serverUrl}/stories/STORY-001`);
  await page.waitForLoadState('load');
  await expect(page.locator('text=Email login')).toBeVisible();
  await expect(page.locator('button', { hasText: 'spec' })).toBeVisible();
  await expect(page.locator('button', { hasText: 'plan' })).toBeVisible();
  await expect(page.locator('button', { hasText: 'changelog' })).toBeVisible();
  await expect(page.locator('button', { hasText: 'tasks' })).toBeVisible();
});

test('clicking a status button on the story page moves the story', async ({ page }) => {
  await page.goto(`${serverUrl}/stories/STORY-001`);
  await page.waitForLoadState('load');

  await expect(page.locator('aside').locator('text=ready').first()).toBeVisible();
  await page.locator('aside').locator('button', { hasText: 'in_progress' }).click();

  await expect(page.locator('aside').locator('text=in_progress').first()).toBeVisible({ timeout: 3000 });

  await page.reload();
  await page.waitForLoadState('load');
  await expect(page.locator('aside').locator('text=in_progress').first()).toBeVisible();
});

test('dragging a story card across columns updates its status', async ({ page }) => {
  await page.goto(`${serverUrl}/features/FEAT-001`);
  await page.waitForLoadState('load');

  // STORY-002 starts in 'ready'; drag it to 'in_progress' (a legal transition from ready).
  const card = page.locator('[data-testid="card-STORY-002"]');
  const inProgress = page.locator('[data-testid="column-in_progress"]');

  // PointerSensor in KanbanBoard requires distance:6 movement before drag activates,
  // so we have to move the mouse explicitly (not just hover + down + hover + up).
  const cardBox = await card.boundingBox();
  const targetBox = await inProgress.boundingBox();
  if (!cardBox || !targetBox) throw new Error('Bounding boxes unavailable');
  const startX = cardBox.x + cardBox.width / 2;
  const startY = cardBox.y + cardBox.height / 2;
  const endX = targetBox.x + targetBox.width / 2;
  const endY = targetBox.y + targetBox.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  // Move in small increments to exceed the distance:6 activation threshold.
  for (let i = 1; i <= 20; i++) {
    await page.mouse.move(startX + (endX - startX) * (i / 20), startY + (endY - startY) * (i / 20));
  }
  await page.mouse.up();

  await expect(inProgress.locator('[data-testid="card-STORY-002"]')).toBeVisible({ timeout: 3000 });

  await page.reload();
  await page.waitForLoadState('load');
  await expect(page.locator('[data-testid="column-in_progress"]').locator('[data-testid="card-STORY-002"]')).toBeVisible();
});

test('attaching a spec.md uploads and renders it', async ({ page }) => {
  await page.goto(`${serverUrl}/stories/STORY-003`);
  await page.waitForLoadState('load');

  await page.locator('button', { hasText: 'spec' }).click();
  await expect(page.locator('text=No spec attached')).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles({
    name: 'spec.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('# Uploaded spec\n\nHello kadai.\n'),
  });

  await expect(page.locator('text=Uploaded spec')).toBeVisible({ timeout: 5000 });
});

test('searching from the top bar lists matches and links to detail pages', async ({ page }) => {
  await page.goto(serverUrl);
  await page.waitForLoadState('load');

  // Type into the top-bar SearchBox.
  const searchInput = page.locator('input[type="search"]');
  await searchInput.fill('Authentication');
  await searchInput.press('Enter');

  // We should land on /search?q=Authentication.
  await page.waitForURL(/\/search\?q=Authentication/);
  await page.waitForLoadState('load');

  // Heading reflects the query.
  await expect(page.locator('h1', { hasText: '"Authentication"' })).toBeVisible();

  // The seeded epic "Authentication" should match by title.
  await expect(page.locator('text=EPIC-001').first()).toBeVisible({ timeout: 5000 });

  // Click the result card → navigate to the epic detail page.
  await page.locator('a', { hasText: 'Authentication' }).first().click();
  await page.waitForURL(/\/epics\/EPIC-001/);
  await page.waitForLoadState('load');
  await expect(page.locator('h1', { hasText: 'Authentication' })).toBeVisible();
});

test('illegal status transition surfaces error from /api/items/:id/status', async ({ page }) => {
  // Move STORY-001 to in_progress via API (it may already be there from a prior test).
  await page.evaluate(async () => {
    await fetch('/api/items/STORY-001/status', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress' }),
    }).catch(() => {/* ignore if already in_progress */});
  });

  await page.goto(`${serverUrl}/stories/STORY-001`);
  await page.waitForLoadState('load');
  await expect(page.locator('aside').locator('text=in_progress').first()).toBeVisible({ timeout: 5000 });

  // Hit the API directly with an illegal target (in_progress → backlog is not legal).
  const result = await page.evaluate(async () => {
    const r = await fetch('/api/items/STORY-001/status', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'backlog' }),
    });
    return { status: r.status, body: await r.json() };
  });
  expect(result.status).toBe(400);
  expect(result.body.error).toMatch(/illegal/i);
});

test('search results page links flow to detail pages', async ({ page }) => {
  await page.goto(serverUrl);
  await page.waitForLoadState('load');

  await page.locator('input[type="search"]').fill('Authentication');
  await page.locator('input[type="search"]').press('Enter');
  await page.waitForURL(/\/search\?q=Authentication/);
  await page.waitForLoadState('load');

  await page.locator('a', { hasText: 'Authentication' }).first().click();
  await page.waitForURL(/\/epics\/EPIC-001/);
  await expect(page.locator('h1', { hasText: 'Authentication' })).toBeVisible();
});

test('attaching a plan via the plan tab uploads and renders', async ({ page }) => {
  await page.goto(`${serverUrl}/stories/STORY-002`);
  await page.waitForLoadState('load');

  await page.locator('button', { hasText: 'plan' }).click();
  await expect(page.locator('text=No plan attached')).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles({
    name: 'plan.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('# Plan\n\n1. Step one\n2. Step two\n'),
  });
  await expect(page.locator('text=Step one')).toBeVisible({ timeout: 5000 });
});

test('Activity page renders the header', async ({ page }) => {
  await page.goto(`${serverUrl}/activity`);
  await page.waitForLoadState('load');
  await expect(page.locator('h1', { hasText: 'Recent changes' })).toBeVisible({ timeout: 8000 });
});

test('Compare page with valid phases renders two columns', async ({ page }) => {
  // Use mvp vs mvp — every seeded item is in mvp, so both columns render the same items
  // and every title is "common" (amber-highlighted). The point here is that the page
  // mounts and the API call succeeds.
  await page.goto(`${serverUrl}/compare?a=mvp&b=mvp`);
  await page.waitForLoadState('load');
  await expect(page.locator('h1', { hasText: 'mvp vs mvp' })).toBeVisible();
  // The seeded epic "Authentication" should appear in the columns.
  await expect(page.locator('text=Authentication').first()).toBeVisible({ timeout: 5000 });
});

test('Compare page without query params shows the picker hint', async ({ page }) => {
  await page.goto(`${serverUrl}/compare`);
  await page.waitForLoadState('load');
  await expect(page.locator('h1', { hasText: 'Pick two phases' })).toBeVisible();
});

test('home page auto-refreshes when an epic is added via the API', async ({ page }) => {
  await page.goto(serverUrl);
  await page.waitForLoadState('load');

  // Sanity: the seeded epic title is visible.
  await expect(page.locator('text=Authentication')).toBeVisible();

  // The seed has already added a feature + 3 stories; trigger an additional change
  // by POSTing a status update via the existing API (Plan 7) — this writes to disk,
  // which the watcher should observe and stream to the browser.
  await page.evaluate(async () => {
    await fetch('/api/items/STORY-001/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress' }),
    });
  });

  // Navigate to the feature page to observe the column re-render. Wait for the
  // card to appear in the in_progress column WITHOUT calling page.reload().
  await page.goto(`${serverUrl}/features/FEAT-001`);
  await page.waitForLoadState('load');
  // Give the EventSource a moment to connect before the second mutation.
  await page.waitForTimeout(100);
  await expect(page.locator('[data-testid="column-in_progress"]').locator('[data-testid="card-STORY-001"]')).toBeVisible({ timeout: 5000 });

  // Now mutate again from outside the tab (via fetch) and watch the column update live.
  await page.evaluate(async () => {
    await fetch('/api/items/STORY-001/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'review' }),
    });
  });

  // No reload — wait for STORY-001 to appear in the review column.
  await expect(page.locator('[data-testid="column-review"]').locator('[data-testid="card-STORY-001"]')).toBeVisible({ timeout: 5000 });
  // And it should no longer be in in_progress.
  await expect(page.locator('[data-testid="column-in_progress"]').locator('[data-testid="card-STORY-001"]')).toHaveCount(0, { timeout: 5000 });
});

async function spawnMultiServer(projAroot: string, projBroot: string): Promise<{ url: string; child: ChildProcess }> {
  const helperScript = join(projAroot, '_multi_helper.ts');
  writeFileSync(helperScript, `
import { runInit } from '${repoRoot}/src/cli/init';
import { runAdd } from '${repoRoot}/src/cli/add';
import { startServer } from '${repoRoot}/src/web/server';
import { resolve } from 'node:path';

const projA = ${JSON.stringify(projAroot)};
const projB = ${JSON.stringify(projBroot)};
const distDir = resolve(${JSON.stringify(repoRoot)}, 'src/web/dist');

runInit({ rootDir: projA, productDescription: 'Alpha', skipFirstEpic: true });
runAdd({ rootDir: projA, kind: 'epic', title: 'Auth', phase: 'mvp' });
runInit({ rootDir: projB, productDescription: 'Beta', skipFirstEpic: true });
runAdd({ rootDir: projB, kind: 'epic', title: 'Billing', phase: 'mvp' });

const handle = await startServer({
  rootDir: projA,
  port: 0,
  distDir,
  projects: [
    { slug: 'alpha', name: 'Alpha', rootDir: projA },
    { slug: 'beta', name: 'Beta', rootDir: projB },
  ],
});
process.stdout.write('READY:' + handle.port + '\\n');
process.stdin.resume();
process.stdin.on('close', async () => { await handle.stop(); process.exit(0); });
`);

  return new Promise((resolve, reject) => {
    const child = spawn('/usr/bin/bun', ['run', helperScript], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout!.on('data', (chunk: Buffer) => {
      output += chunk.toString();
      const match = output.match(/READY:(\d+)/);
      if (match) {
        resolve({ url: `http://localhost:${match[1]}`, child });
      }
    });
    child.stderr!.on('data', (chunk: Buffer) => {
      process.stderr.write(chunk);
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        reject(new Error(`multi-server process exited with code ${code}`));
      }
    });
    setTimeout(() => reject(new Error('Multi-server did not start within 15s')), 15_000);
  });
}

test.describe('multi-project', () => {
  let multiTmpA: string;
  let multiTmpB: string;
  let multiChild: ChildProcess;
  let multiUrl: string;

  test.beforeAll(async () => {
    multiTmpA = mkdtempSync(join(tmpdir(), 'kadai-e2e-mp-a-'));
    multiTmpB = mkdtempSync(join(tmpdir(), 'kadai-e2e-mp-b-'));
    const result = await spawnMultiServer(multiTmpA, multiTmpB);
    multiUrl = result.url;
    multiChild = result.child;
  });

  test.afterAll(async () => {
    if (multiChild) {
      multiChild.stdin?.end();
      await new Promise<void>(res => setTimeout(res, 500));
      if (!multiChild.killed) multiChild.kill();
    }
    rmSync(multiTmpA, { recursive: true, force: true });
    rmSync(multiTmpB, { recursive: true, force: true });
  });

  test('GET /projects renders the picker with both projects', async ({ page }) => {
    await page.goto(`${multiUrl}/projects`);
    await page.waitForLoadState('load');
    await expect(page.locator('h1', { hasText: 'Projects' })).toBeVisible();
    await expect(page.locator('text=Alpha').first()).toBeVisible();
    await expect(page.locator('text=Beta').first()).toBeVisible();
  });

  test('clicking a project card lands on /p/<slug>/', async ({ page }) => {
    await page.goto(`${multiUrl}/projects`);
    await page.waitForLoadState('load');
    await page.locator('a', { hasText: 'Alpha' }).first().click();
    await page.waitForURL(/\/p\/alpha\//);
  });

  test('the project header shows the active project name + switcher link', async ({ page }) => {
    await page.goto(`${multiUrl}/p/alpha/`);
    await page.waitForLoadState('load');
    await expect(page.locator('text=Project:').first()).toBeVisible();
    await expect(page.locator('text=Alpha')).toBeVisible();
    await expect(page.locator('a', { hasText: '← Switch' })).toBeVisible();
  });

  test('alpha and beta show different epics on their respective home pages', async ({ page }) => {
    await page.goto(`${multiUrl}/p/alpha/`);
    await page.waitForLoadState('load');
    await expect(page.locator('text=Auth')).toBeVisible();
    await page.goto(`${multiUrl}/p/beta/`);
    await page.waitForLoadState('load');
    await expect(page.locator('text=Billing')).toBeVisible();
  });
});
