import { test, expect } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { recordDependencyEdge, formatBlockerPrompt } from '../../src/runner/blocker';

function seedStory(root: string) {
  const story = join(root, '.kadai/epics/EPIC-001-x/features/FEAT-001-y/stories/STORY-007-z');
  mkdirSync(story, { recursive: true });
  writeFileSync(join(story, 'story.md'), '---\nid: STORY-007\nparent: FEAT-001\ntitle: Original story\nphase: mvp\nstatus: in_progress\ncreated: "2026-01-01"\nupdated: "2026-01-01"\norder: 1\n---\n# body\n');
  writeFileSync(join(root, '.kadai/epics/EPIC-001-x/epic.md'), '---\nid: EPIC-001\ntitle: X\nphase: mvp\nstatus: in_progress\ncreated: "2026-01-01"\nupdated: "2026-01-01"\norder: 1\n---\n');
  writeFileSync(join(root, '.kadai/epics/EPIC-001-x/features/FEAT-001-y/feature.md'), '---\nid: FEAT-001\nparent: EPIC-001\ntitle: Y\nphase: mvp\nstatus: in_progress\ncreated: "2026-01-01"\nupdated: "2026-01-01"\norder: 1\n---\n');
  writeFileSync(join(root, '.kadai/.counters.json'), '{"epic":1,"feature":1,"story":7,"task":0}');
  writeFileSync(join(root, '.kadai/config.toml'), '[guardrail]\nallowed_paths = []\n[change_capture]\nenabled = true\n');
  return story;
}

test('recordDependencyEdge writes a dependsOn field to the blocked story frontmatter', () => {
  const root = mkdtempSync(join(tmpdir(), 'kadai-blocker-'));
  try {
    const storyDir = seedStory(root);
    recordDependencyEdge(root, 'STORY-007', 'FEAT-009');
    const updated = readFileSync(join(storyDir, 'story.md'), 'utf8');
    expect(updated).toMatch(/^dependsOn:\s*\[FEAT-009\]/m);
    expect(updated).toContain('# body');  // body preserved
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('recordDependencyEdge appends to existing dependsOn array (idempotent for same id)', () => {
  const root = mkdtempSync(join(tmpdir(), 'kadai-blocker-'));
  try {
    const storyDir = seedStory(root);
    recordDependencyEdge(root, 'STORY-007', 'FEAT-009');
    recordDependencyEdge(root, 'STORY-007', 'FEAT-010');
    recordDependencyEdge(root, 'STORY-007', 'FEAT-009');  // duplicate, no-op
    const updated = readFileSync(join(storyDir, 'story.md'), 'utf8');
    expect(updated).toMatch(/dependsOn:\s*\[FEAT-009, FEAT-010\]/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('formatBlockerPrompt produces a clear human-readable summary for needs-feature', () => {
  const out = formatBlockerPrompt({
    storyId: 'STORY-007',
    taskTitle: 'Task 4: Wire SES',
    blocker: { kind: 'needs-feature', description: 'A reusable config loader before this story can wire SES correctly', suggestedTitle: 'Config loader' },
  });
  expect(out).toContain('STORY-007');
  expect(out).toContain('Task 4: Wire SES');
  expect(out).toContain('Config loader');
  expect(out).toContain('config loader before this story');
  expect(out).toMatch(/\[Y\/n\/skip\]/);
});

test('formatBlockerPrompt produces a different summary for generic blockers', () => {
  const out = formatBlockerPrompt({
    storyId: 'STORY-008',
    taskTitle: 'Task 1: Make it work',
    blocker: { kind: 'generic', reason: 'turned out to be way harder than expected' },
  });
  expect(out).toContain('STORY-008');
  expect(out).toContain('way harder than expected');
  expect(out).not.toMatch(/needs-feature|fast.follow.up/i);
});
