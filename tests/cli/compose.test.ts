import { test, expect } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { composePlan } from '../../src/cli/compose';

function seedSpine(root: string) {
  // EPIC-001 / FEAT-001 / STORY-001 / STORY-002, each with a plan.md
  const story1 = join(root, '.kadai/epics/EPIC-001-auth/features/FEAT-001-email/stories/STORY-001-magic-link');
  const story2 = join(root, '.kadai/epics/EPIC-001-auth/features/FEAT-001-email/stories/STORY-002-pw-reset');
  mkdirSync(story1, { recursive: true });
  mkdirSync(story2, { recursive: true });
  writeFileSync(join(root, '.kadai/epics/EPIC-001-auth/epic.md'), '---\nid: EPIC-001\ntitle: Authentication\nphase: mvp\nstatus: in_progress\ncreated: "2026-01-01"\nupdated: "2026-01-01"\norder: 1\n---\n# Authentication\n');
  writeFileSync(join(root, '.kadai/epics/EPIC-001-auth/features/FEAT-001-email/feature.md'), '---\nid: FEAT-001\nparent: EPIC-001\ntitle: Email login\nphase: mvp\nstatus: in_progress\ncreated: "2026-01-01"\nupdated: "2026-01-01"\norder: 1\n---\n# Email login\n');
  writeFileSync(join(story1, 'story.md'), '---\nid: STORY-001\nparent: FEAT-001\ntitle: Magic link delivery\nphase: mvp\nstatus: ready\ncreated: "2026-01-01"\nupdated: "2026-01-01"\norder: 1\n---\n');
  writeFileSync(join(story2, 'story.md'), '---\nid: STORY-002\nparent: FEAT-001\ntitle: Password reset\nphase: mvp\nstatus: ready\ncreated: "2026-01-01"\nupdated: "2026-01-01"\norder: 2\n---\n');
  writeFileSync(join(story1, 'plan.md'), '# STORY-001 Plan\n\n## Task 1: Wire SES\n\nCode here.\n');
  writeFileSync(join(story2, 'plan.md'), '# STORY-002 Plan\n\n## Task 1: Token rotation\n');
  writeFileSync(join(root, '.kadai/.counters.json'), JSON.stringify({ epic: 1, feature: 1, story: 2, task: 0 }));
  writeFileSync(join(root, '.kadai/config.toml'), '[guardrail]\nallowed_paths = []\n[change_capture]\nenabled = true\n');
}

test('compose EPIC-001 returns composite of all descendant story plans', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'kadai-compose-'));
  try {
    seedSpine(tmp);
    const out = composePlan(tmp, 'EPIC-001');
    expect(out).toContain('# Composite plan — EPIC-001');
    expect(out).toContain('## STORY-001 — Magic link delivery');
    expect(out).toContain('Wire SES');
    expect(out).toContain('## STORY-002 — Password reset');
    expect(out).toContain('Token rotation');
    expect(out!.indexOf('STORY-001')).toBeLessThan(out!.indexOf('STORY-002'));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('compose FEAT-001 returns same descendants when scoped to feature', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'kadai-compose-'));
  try {
    seedSpine(tmp);
    const out = composePlan(tmp, 'FEAT-001');
    expect(out).toContain('# Composite plan — FEAT-001');
    expect(out).toContain('STORY-001');
    expect(out).toContain('STORY-002');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('compose returns null for unknown ID', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'kadai-compose-'));
  try {
    seedSpine(tmp);
    expect(composePlan(tmp, 'EPIC-999')).toBeNull();
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('compose marks stories without plan.md as "no plan yet"', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'kadai-compose-'));
  try {
    seedSpine(tmp);
    const story3 = join(tmp, '.kadai/epics/EPIC-001-auth/features/FEAT-001-email/stories/STORY-003-tokens');
    mkdirSync(story3, { recursive: true });
    writeFileSync(join(story3, 'story.md'), '---\nid: STORY-003\nparent: FEAT-001\ntitle: Tokens\nphase: mvp\nstatus: backlog\ncreated: "2026-01-01"\nupdated: "2026-01-01"\norder: 3\n---\n');
    const out = composePlan(tmp, 'EPIC-001');
    expect(out).toContain('STORY-001');
    expect(out).toContain('STORY-002');
    expect(out).toContain('STORY-003');
    expect(out).toMatch(/STORY-003.*no plan yet/s);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
