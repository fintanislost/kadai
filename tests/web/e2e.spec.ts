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
