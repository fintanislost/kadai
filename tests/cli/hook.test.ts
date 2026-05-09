import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { evaluatePreToolUse, recordPostToolUse, buildActiveStoryContext, buildStopReminder, hookCommand } from "../../src/cli/hook";
import { runInit } from "../../src/cli/init";
import { runAdd } from "../../src/cli/add";
import { setPicked } from "../../src/core/picked";
import { findById } from "../../src/core/spine";
import { setConfigKey } from "../../src/cli/config";
import { setDisabled } from "../../src/core/toggle";

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "kadai-hook-pre-"));
  runInit({ rootDir: tmp, productDescription: "X", skipFirstEpic: true });
});
afterEach(() => {
  delete process.env.KADAI_BYPASS;
  delete process.env.KADAI_BYPASS_REASON;
  rmSync(tmp, { recursive: true, force: true });
});

test("allows edit to a path inside .kadai/", () => {
  const input = { tool_name: "Edit", tool_input: { file_path: join(tmp, ".kadai/epics/foo.md") } };
  expect(evaluatePreToolUse(input, tmp).allow).toBe(true);
});

test("allows edit to a file in [guardrail.allowed_paths]", () => {
  const input = { tool_name: "Edit", tool_input: { file_path: join(tmp, "docs/some-file.md") } };
  expect(evaluatePreToolUse(input, tmp).allow).toBe(true);
});

test("blocks edit to a path outside .kadai/ and allowlist when no story picked", () => {
  const input = { tool_name: "Edit", tool_input: { file_path: join(tmp, "src/foo.ts") } };
  const result = evaluatePreToolUse(input, tmp);
  expect(result.allow).toBe(false);
  expect(result.message).toMatch(/no story is picked/i);
});

test("allows edit outside .kadai/ when a story is picked", () => {
  runAdd({ rootDir: tmp, kind: "epic", title: "A", phase: "mvp" });
  runAdd({ rootDir: tmp, kind: "feature", title: "F", phase: "mvp", parent: "EPIC-001" });
  runAdd({ rootDir: tmp, kind: "story", title: "S", phase: "mvp", parent: "FEAT-001" });
  setPicked(tmp, "STORY-001");
  const input = { tool_name: "Edit", tool_input: { file_path: join(tmp, "src/foo.ts") } };
  expect(evaluatePreToolUse(input, tmp).allow).toBe(true);
});

test("KADAI_BYPASS=1 allows blocked edit and writes to bypass.log", () => {
  process.env.KADAI_BYPASS = "1";
  process.env.KADAI_BYPASS_REASON = "quick docs fix";
  const input = { tool_name: "Edit", tool_input: { file_path: join(tmp, "src/foo.ts") } };
  expect(evaluatePreToolUse(input, tmp).allow).toBe(true);
  const logPath = join(tmp, ".kadai/bypass.log");
  expect(existsSync(logPath)).toBe(true);
  const log = readFileSync(logPath, "utf8");
  expect(log).toContain("src/foo.ts");
  expect(log).toContain("quick docs fix");
});

test("only Edit and Write tools are evaluated; other tools allow through", () => {
  const input = { tool_name: "Read", tool_input: { file_path: join(tmp, "src/foo.ts") } };
  expect(evaluatePreToolUse(input, tmp).allow).toBe(true);
});

test("recordPostToolUse appends to picked story changelog when picked", () => {
  runAdd({ rootDir: tmp, kind: "epic", title: "A", phase: "mvp" });
  runAdd({ rootDir: tmp, kind: "feature", title: "F", phase: "mvp", parent: "EPIC-001" });
  runAdd({ rootDir: tmp, kind: "story", title: "S", phase: "mvp", parent: "FEAT-001" });
  setPicked(tmp, "STORY-001");
  recordPostToolUse({
    tool_name: "Edit",
    tool_input: { file_path: join(tmp, "src/foo.ts") },
  }, tmp);
  const story = findById(tmp, "STORY-001");
  const changelogPath = join(dirname(story!.path), "changelog.md");
  expect(existsSync(changelogPath)).toBe(true);
  const content = readFileSync(changelogPath, "utf8");
  expect(content).toContain("Edit");
  expect(content).toContain("src/foo.ts");
});

test("recordPostToolUse is a no-op when no story picked", () => {
  // Should not throw and should not create any changelog
  expect(() => recordPostToolUse({
    tool_name: "Edit",
    tool_input: { file_path: join(tmp, "src/foo.ts") },
  }, tmp)).not.toThrow();
});

test("recordPostToolUse is a no-op when change_capture.enabled = false", () => {
  runAdd({ rootDir: tmp, kind: "epic", title: "A", phase: "mvp" });
  runAdd({ rootDir: tmp, kind: "feature", title: "F", phase: "mvp", parent: "EPIC-001" });
  runAdd({ rootDir: tmp, kind: "story", title: "S", phase: "mvp", parent: "FEAT-001" });
  setPicked(tmp, "STORY-001");
  setConfigKey(tmp, "change_capture.enabled", "false");
  recordPostToolUse({
    tool_name: "Edit",
    tool_input: { file_path: join(tmp, "src/foo.ts") },
  }, tmp);
  const story = findById(tmp, "STORY-001");
  const changelogPath = join(dirname(story!.path), "changelog.md");
  expect(existsSync(changelogPath)).toBe(false);
});

test("recordPostToolUse only acts on Edit and Write tools", () => {
  runAdd({ rootDir: tmp, kind: "epic", title: "A", phase: "mvp" });
  runAdd({ rootDir: tmp, kind: "feature", title: "F", phase: "mvp", parent: "EPIC-001" });
  runAdd({ rootDir: tmp, kind: "story", title: "S", phase: "mvp", parent: "FEAT-001" });
  setPicked(tmp, "STORY-001");
  recordPostToolUse({
    tool_name: "Read",
    tool_input: { file_path: join(tmp, "src/foo.ts") },
  }, tmp);
  const story = findById(tmp, "STORY-001");
  const changelogPath = join(dirname(story!.path), "changelog.md");
  expect(existsSync(changelogPath)).toBe(false);
});

test("hookCommand registers pre-tool-use and post-tool-use subcommands", () => {
  expect(hookCommand.name()).toBe("hook");
  const subNames = hookCommand.commands.map(c => c.name());
  expect(subNames).toContain("pre-tool-use");
  expect(subNames).toContain("post-tool-use");
});

// --- Disabled-no-op tests (Task 2) ---

test("evaluatePreToolUse allows the edit when kadai is disabled (no story needed)", () => {
  const tmp2 = mkdtempSync(join(tmpdir(), "kadai-hook-disabled-"));
  try {
    runInit({ rootDir: tmp2, productDescription: "X", skipFirstEpic: true });
    setDisabled(tmp2);
    const result = evaluatePreToolUse({ tool_name: "Write", tool_input: { file_path: join(tmp2, "src/foo.ts") } }, tmp2);
    expect(result.allow).toBe(true);
  } finally { rmSync(tmp2, { recursive: true, force: true }); }
});

test("recordPostToolUse skips changelog write when kadai is disabled", () => {
  const tmp2 = mkdtempSync(join(tmpdir(), "kadai-hook-disabled-"));
  try {
    runInit({ rootDir: tmp2, productDescription: "X", skipFirstEpic: true });
    runAdd({ rootDir: tmp2, kind: "epic", title: "A", phase: "mvp" });
    runAdd({ rootDir: tmp2, kind: "feature", title: "F", phase: "mvp", parent: "EPIC-001" });
    runAdd({ rootDir: tmp2, kind: "story", title: "S", phase: "mvp", parent: "FEAT-001" });
    setPicked(tmp2, "STORY-001");
    setDisabled(tmp2);
    recordPostToolUse({ tool_name: "Write", tool_input: { file_path: join(tmp2, "src/foo.ts") } }, tmp2);
    const story = findById(tmp2, "STORY-001");
    const changelogPath = join(dirname(story!.path), "changelog.md");
    expect(existsSync(changelogPath)).toBe(false);
  } finally { rmSync(tmp2, { recursive: true, force: true }); }
});

test("buildActiveStoryContext returns null when kadai is disabled", () => {
  const tmp2 = mkdtempSync(join(tmpdir(), "kadai-hook-disabled-"));
  try {
    runInit({ rootDir: tmp2, productDescription: "X", skipFirstEpic: true });
    runAdd({ rootDir: tmp2, kind: "epic", title: "A", phase: "mvp" });
    runAdd({ rootDir: tmp2, kind: "feature", title: "F", phase: "mvp", parent: "EPIC-001" });
    runAdd({ rootDir: tmp2, kind: "story", title: "S", phase: "mvp", parent: "FEAT-001" });
    setPicked(tmp2, "STORY-001");
    setDisabled(tmp2);
    expect(buildActiveStoryContext(tmp2)).toBeNull();
  } finally { rmSync(tmp2, { recursive: true, force: true }); }
});

test("buildStopReminder returns null when kadai is disabled", () => {
  const tmp2 = mkdtempSync(join(tmpdir(), "kadai-hook-disabled-"));
  try {
    runInit({ rootDir: tmp2, productDescription: "X", skipFirstEpic: true });
    runAdd({ rootDir: tmp2, kind: "epic", title: "A", phase: "mvp" });
    runAdd({ rootDir: tmp2, kind: "feature", title: "F", phase: "mvp", parent: "EPIC-001" });
    runAdd({ rootDir: tmp2, kind: "story", title: "S", phase: "mvp", parent: "FEAT-001" });
    setPicked(tmp2, "STORY-001");
    setDisabled(tmp2);
    expect(buildStopReminder(tmp2)).toBeNull();
  } finally { rmSync(tmp2, { recursive: true, force: true }); }
});
