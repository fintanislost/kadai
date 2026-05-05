import { test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { _resetRegistry, getTool } from '../../../src/mcp/registry';
import { registerAttachTools } from '../../../src/mcp/handlers/attach';
import { runInit } from '../../../src/cli/init';
import { runAdd } from '../../../src/cli/add';
import { findById } from '../../../src/core/spine';

let tmp: string;
beforeEach(() => {
  _resetRegistry();
  registerAttachTools();
  tmp = mkdtempSync(join(tmpdir(), 'kadai-mcp-attach-'));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'A', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'feature', title: 'F', phase: 'mvp', parent: 'EPIC-001' });
  runAdd({ rootDir: tmp, kind: 'story', title: 'S', phase: 'mvp', parent: 'FEAT-001' });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

const ctx = () => ({ rootDir: tmp });

function writeSpec(relPath: string, content: string): string {
  const abs = join(tmp, relPath);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
  return abs;
}

test('attach_spec moves spec into feature dir and updates frontmatter', async () => {
  const sourcePath = writeSpec('docs/superpowers/specs/feature-spec.md', '# Spec\n\nContent here.');
  const tool = getTool('attach_spec')!;
  await tool.handler({ feature_id: 'FEAT-001', source_path: sourcePath }, ctx());

  const feature = findById(tmp, 'FEAT-001');
  const featureDir = dirname(feature!.path);
  expect(existsSync(join(featureDir, 'spec.md'))).toBe(true);
  expect(existsSync(sourcePath)).toBe(false);
  expect((feature?.data as any).spec).toBe('spec.md');
});

test('attach_plan moves plan into story dir and updates frontmatter', async () => {
  const sourcePath = writeSpec('docs/superpowers/plans/story-plan.md', '# Plan\n\nSteps here.');
  const tool = getTool('attach_plan')!;
  await tool.handler({ story_id: 'STORY-001', source_path: sourcePath }, ctx());

  const story = findById(tmp, 'STORY-001');
  const storyDir = dirname(story!.path);
  expect(existsSync(join(storyDir, 'plan.md'))).toBe(true);
  expect(existsSync(sourcePath)).toBe(false);
  expect((story?.data as any).plan).toBe('plan.md');
});

test('attach_spec errors if feature not found', async () => {
  const sourcePath = writeSpec('docs/superpowers/specs/x.md', 'x');
  const tool = getTool('attach_spec')!;
  await expect(tool.handler({ feature_id: 'FEAT-999', source_path: sourcePath }, ctx()))
    .rejects.toThrow(/feature not found/i);
});

test('attach_spec errors if source file missing', async () => {
  const tool = getTool('attach_spec')!;
  await expect(tool.handler({
    feature_id: 'FEAT-001', source_path: join(tmp, 'docs/missing.md'),
  }, ctx())).rejects.toThrow(/source.*not found|no such file/i);
});
