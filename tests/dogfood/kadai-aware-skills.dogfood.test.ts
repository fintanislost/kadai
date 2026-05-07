import { test, expect } from 'bun:test';
import { mkdtempSync, existsSync, rmSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const HAS_CLAUDE_CLI = (() => {
  try { execFileSync('which', ['claude'], { stdio: 'pipe' }); return true; }
  catch { return false; }
})();

const HAS_KADAI_CLI = (() => {
  try { execFileSync('which', ['kadai'], { stdio: 'pipe' }); return true; }
  catch { return false; }
})();

// Skip the test entirely if either CLI is missing — running in CI without them is fine.
test.skipIf(!HAS_CLAUDE_CLI || !HAS_KADAI_CLI)(
  'claude -p in a fresh kadai repo runs the wrapper flow end-to-end',
  async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'kadai-dogfood-'));
    try {
      // 1. Init kadai in the temp project.
      execFileSync('kadai', ['init', '-y'], { cwd: tmp, stdio: 'pipe' });
      expect(existsSync(join(tmp, '.kadai/config.toml'))).toBe(true);

      // 2. Run claude -p with a brainstorming prompt. The wrapper should fire because .kadai/ exists.
      const prompt = "Use kadai-brainstorming and kadai-writing-plans to plan a small CLI tool that converts Markdown to plaintext. Keep it minimal: one command, one input file, one output file. Don't ask me clarifying questions — make reasonable choices and proceed. After the plan is written, stop.";
      execFileSync('claude', ['-p', prompt], { cwd: tmp, stdio: 'pipe', timeout: 8 * 60 * 1000 });

      // 3. Assert on the resulting spine state.
      // Should have: 1 epic, 1 feature with spec.md attached, ≥1 story with plan.md attached, ≥1 task per story.
      const epicsDir = join(tmp, '.kadai/epics');
      expect(existsSync(epicsDir)).toBe(true);
      const epicDirs = readdirSync(epicsDir).filter(d => d.startsWith('EPIC-'));
      expect(epicDirs.length).toBeGreaterThanOrEqual(1);

      const epicDir = join(epicsDir, epicDirs[0]);
      const featuresDir = join(epicDir, 'features');
      expect(existsSync(featuresDir)).toBe(true);
      const featureDirs = readdirSync(featuresDir).filter(d => d.startsWith('FEAT-'));
      expect(featureDirs.length).toBeGreaterThanOrEqual(1);

      const featureDir = join(featuresDir, featureDirs[0]);
      // CRITICAL: spec.md should be in the feature directory, NOT in docs/superpowers/
      expect(existsSync(join(featureDir, 'spec.md'))).toBe(true);
      expect(existsSync(join(tmp, 'docs/superpowers/specs'))).toBe(false);

      const storiesDir = join(featureDir, 'stories');
      expect(existsSync(storiesDir)).toBe(true);
      const storyDirs = readdirSync(storiesDir).filter(d => d.startsWith('STORY-'));
      expect(storyDirs.length).toBeGreaterThanOrEqual(1);

      // Each story should have a plan.md attached.
      for (const sd of storyDirs) {
        expect(existsSync(join(storiesDir, sd, 'plan.md'))).toBe(true);
      }

      // The first story should be picked.
      const picked = execFileSync('kadai', ['status'], { cwd: tmp, encoding: 'utf8' });
      expect(picked).toMatch(/STORY-/);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  },
  10 * 60 * 1000  // 10-minute test timeout
);

test('kadai-runner pauses correctly when implementer reports needs-feature', async () => {
  // This is a unit-style test of the pause flow without actually invoking claude -p
  // (which is harder to script for an artificial blocker scenario). We seed a project
  // where the picked story's plan has a task whose body contains the literal
  // "PLEASE_FAIL_WITH_NEEDS_FEATURE" — the test dispatcher recognizes it and reports
  // BLOCKED: needs-feature: <something>. We then verify the runner state.

  const { runOnce } = await import('../../src/cli/run');
  const story = (root: string) => join(root, '.kadai/epics/EPIC-001-x/features/FEAT-001-y/stories/STORY-001-a');

  const root = mkdtempSync(join(tmpdir(), 'kadai-pause-'));
  try {
    mkdirSync(story(root), { recursive: true });
    writeFileSync(join(root, '.kadai/epics/EPIC-001-x/epic.md'), '---\nid: EPIC-001\ntitle: X\nphase: mvp\nstatus: in_progress\ncreated: "2026-01-01"\nupdated: "2026-01-01"\norder: 1\n---\n');
    writeFileSync(join(root, '.kadai/epics/EPIC-001-x/features/FEAT-001-y/feature.md'), '---\nid: FEAT-001\nparent: EPIC-001\ntitle: Y\nphase: mvp\nstatus: in_progress\ncreated: "2026-01-01"\nupdated: "2026-01-01"\norder: 1\n---\n');
    writeFileSync(join(story(root), 'story.md'), '---\nid: STORY-001\nparent: FEAT-001\ntitle: First\nphase: mvp\nstatus: in_progress\ncreated: "2026-01-01"\nupdated: "2026-01-01"\norder: 1\n---\n');
    writeFileSync(join(story(root), 'plan.md'), '## Task 1: alpha\n\nPLEASE_FAIL_WITH_NEEDS_FEATURE\n');
    writeFileSync(join(root, '.kadai/.counters.json'), '{"epic":1,"feature":1,"story":1,"task":0}');
    writeFileSync(join(root, '.kadai/config.toml'), '[guardrail]\nallowed_paths = []\n[change_capture]\nenabled = true\n');
    writeFileSync(join(root, '.kadai/picked'), 'STORY-001');

    const dispatcher = async (_: string, body: string) => {
      if (body.includes('PLEASE_FAIL_WITH_NEEDS_FEATURE')) {
        return { status: 'BLOCKED' as const, reason: 'needs-feature: a config-loading utility' };
      }
      return { status: 'DONE' as const };
    };
    const result = await runOnce(root, dispatcher);
    expect(result.kind).toBe('paused-needs-feature');
    if (result.kind === 'paused-needs-feature') {
      expect(result.description).toBe('a config-loading utility');
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});
