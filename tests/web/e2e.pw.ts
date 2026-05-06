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
  await page.waitForLoadState('networkidle');
  await expect(page.locator('text=Authentication')).toBeVisible();
});

test('drilling into an epic shows its features', async ({ page }) => {
  await page.goto(serverUrl);
  await page.waitForLoadState('networkidle');
  await page.locator('text=Authentication').click();
  await expect(page.locator('text=Login')).toBeVisible();
});

test('drilling into a story shows the tabs', async ({ page }) => {
  await page.goto(`${serverUrl}/stories/STORY-001`);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('text=Email login')).toBeVisible();
  await expect(page.locator('button', { hasText: 'spec' })).toBeVisible();
  await expect(page.locator('button', { hasText: 'plan' })).toBeVisible();
  await expect(page.locator('button', { hasText: 'changelog' })).toBeVisible();
  await expect(page.locator('button', { hasText: 'tasks' })).toBeVisible();
});

test('clicking a status button on the story page moves the story', async ({ page }) => {
  await page.goto(`${serverUrl}/stories/STORY-001`);
  await page.waitForLoadState('networkidle');

  await expect(page.locator('aside').locator('text=ready').first()).toBeVisible();
  await page.locator('aside').locator('button', { hasText: 'in_progress' }).click();

  await expect(page.locator('aside').locator('text=in_progress').first()).toBeVisible({ timeout: 3000 });

  await page.reload();
  await page.waitForLoadState('networkidle');
  await expect(page.locator('aside').locator('text=in_progress').first()).toBeVisible();
});

test('dragging a story card across columns updates its status', async ({ page }) => {
  await page.goto(`${serverUrl}/features/FEAT-001`);
  await page.waitForLoadState('networkidle');

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
  await page.waitForLoadState('networkidle');
  await expect(page.locator('[data-testid="column-in_progress"]').locator('[data-testid="card-STORY-002"]')).toBeVisible();
});

test('attaching a spec.md uploads and renders it', async ({ page }) => {
  await page.goto(`${serverUrl}/stories/STORY-003`);
  await page.waitForLoadState('networkidle');

  await page.locator('button', { hasText: 'spec' }).click();
  await expect(page.locator('text=No spec attached')).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles({
    name: 'spec.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('# Uploaded spec\n\nHello kadai.\n'),
  });

  await expect(page.locator('text=Uploaded spec')).toBeVisible({ timeout: 5000 });
});
