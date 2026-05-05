import { test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { runInit } from '../../src/cli/init';
import { runAdd } from '../../src/cli/add';
import { setPicked, clearPicked } from '../../src/core/picked';
import { findById } from '../../src/core/spine';

const REPO_ROOT = '/home/fintan/repos/kadai';
const CLI_PATH = join(REPO_ROOT, 'src/cli/index.ts');

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'kadai-hook-int-'));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

async function runHook(
  subcommand: 'pre-tool-use' | 'post-tool-use',
  hookInput: object,
  cwd: string,
  env: Record<string, string> = {},
): Promise<{ exitCode: number | null; stderr: string }> {
  const proc = Bun.spawn(['bun', 'run', CLI_PATH, 'hook', subcommand], {
    stdin: 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
    cwd,
    env: { ...process.env, ...env },
  });
  proc.stdin.write(JSON.stringify(hookInput));
  proc.stdin.end();
  const exitCode = await proc.exited;
  const stderr = await new Response(proc.stderr).text();
  return { exitCode, stderr };
}

test('pre-tool-use blocks edit outside .kadai/ when no story picked', async () => {
  const { exitCode, stderr } = await runHook(
    'pre-tool-use',
    { tool_name: 'Edit', tool_input: { file_path: join(tmp, 'src/foo.ts') } },
    tmp,
  );
  expect(exitCode).toBe(2);
  expect(stderr).toMatch(/no story is picked/i);
});

test('pre-tool-use allows edit when a story is picked', async () => {
  runAdd({ rootDir: tmp, kind: 'epic', title: 'A', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'feature', title: 'F', phase: 'mvp', parent: 'EPIC-001' });
  runAdd({ rootDir: tmp, kind: 'story', title: 'S', phase: 'mvp', parent: 'FEAT-001' });
  setPicked(tmp, 'STORY-001');
  const { exitCode } = await runHook(
    'pre-tool-use',
    { tool_name: 'Edit', tool_input: { file_path: join(tmp, 'src/foo.ts') } },
    tmp,
  );
  expect(exitCode).toBe(0);
});

test('pre-tool-use allows edit when KADAI_BYPASS=1', async () => {
  const { exitCode } = await runHook(
    'pre-tool-use',
    { tool_name: 'Edit', tool_input: { file_path: join(tmp, 'src/foo.ts') } },
    tmp,
    { KADAI_BYPASS: '1', KADAI_BYPASS_REASON: 'test bypass' },
  );
  expect(exitCode).toBe(0);
  const log = readFileSync(join(tmp, '.kadai/bypass.log'), 'utf8');
  expect(log).toContain('test bypass');
});

test('pre-tool-use exits 0 when cwd is not under a kadai project', async () => {
  const noKadaiTmp = mkdtempSync(join(tmpdir(), 'no-kadai-'));
  try {
    const { exitCode } = await runHook(
      'pre-tool-use',
      { tool_name: 'Edit', tool_input: { file_path: join(noKadaiTmp, 'foo.ts') } },
      noKadaiTmp,
    );
    expect(exitCode).toBe(0);
  } finally {
    rmSync(noKadaiTmp, { recursive: true, force: true });
  }
});

test('post-tool-use appends to picked story changelog', async () => {
  runAdd({ rootDir: tmp, kind: 'epic', title: 'A', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'feature', title: 'F', phase: 'mvp', parent: 'EPIC-001' });
  runAdd({ rootDir: tmp, kind: 'story', title: 'S', phase: 'mvp', parent: 'FEAT-001' });
  setPicked(tmp, 'STORY-001');
  const { exitCode } = await runHook(
    'post-tool-use',
    { tool_name: 'Edit', tool_input: { file_path: join(tmp, 'src/foo.ts') } },
    tmp,
  );
  expect(exitCode).toBe(0);
  const story = findById(tmp, 'STORY-001');
  const changelogPath = join(dirname(story!.path), 'changelog.md');
  expect(existsSync(changelogPath)).toBe(true);
  const content = readFileSync(changelogPath, 'utf8');
  expect(content).toContain('Edit');
  expect(content).toContain('src/foo.ts');
  clearPicked(tmp);
});
