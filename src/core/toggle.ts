import { existsSync, readFileSync, unlinkSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { writeFileAtomic } from "./files";
import { findKadaiRoot } from "./find-root";

const DISABLED_FILE = ".kadai/disabled";
const ENV_DISABLED_FLAG = "KADAI_DISABLED";

export type DisabledScope = "project" | "global" | "env" | "both";

export interface DisabledInfo {
  /** Where the disabled state came from. "both" = project AND global file present.
   *  "env" wins over file presence in display, since env is the loudest signal
   *  for the current shell. */
  scope: DisabledScope;
  /** The most-recently-set timestamp across the scope sources. Falls back to
   *  the Unix epoch if no file source exists (i.e., env-only disable). */
  since: string;
  reason?: string;
}

function projectDisabledPath(rootDir: string): string {
  return join(rootDir, DISABLED_FILE);
}

/** Resolve the user's kadai home dir. KADAI_HOME overrides homedir() — this is
 *  primarily for tests (so they never touch the real ~/.kadai), but also a
 *  legitimate escape hatch for shared machines or non-default dotfile setups. */
function kadaiHomeDir(): string {
  return process.env.KADAI_HOME ?? homedir();
}

function globalDisabledPath(): string {
  return join(kadaiHomeDir(), ".kadai", "disabled");
}

function isEnvDisabled(): boolean {
  const v = process.env[ENV_DISABLED_FLAG];
  return v === "1" || v === "true";
}

function readFlagFile(path: string): { since: string; reason?: string } | null {
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, "utf8");
  const since = raw.match(/^disabled-since:\s*(.+)$/m)?.[1]?.trim() ?? new Date(0).toISOString();
  const reasonMatch = raw.match(/^reason:\s*(.+)$/m);
  const reason = reasonMatch?.[1]?.trim();
  return reason ? { since, reason } : { since };
}

function writeFlagFile(path: string, reason?: string): void {
  const since = new Date().toISOString();
  const lines: string[] = [`disabled-since: ${since}`];
  if (reason !== undefined && reason !== "") {
    lines.push(`reason: ${reason}`);
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileAtomic(path, lines.join("\n") + "\n");
}

/** True if kadai is disabled by ANY source: env var, global file, or project file. */
export function isDisabled(rootDir: string): boolean {
  if (isEnvDisabled()) return true;
  if (existsSync(globalDisabledPath())) return true;
  return existsSync(projectDisabledPath(rootDir));
}

/** Project-level disable. Writes .kadai/disabled. */
export function setDisabled(rootDir: string, reason?: string): void {
  writeFlagFile(projectDisabledPath(rootDir), reason);
}

/** Project-level clear. Removes .kadai/disabled. Idempotent. */
export function clearDisabled(rootDir: string): void {
  const path = projectDisabledPath(rootDir);
  if (!existsSync(path)) return;
  unlinkSync(path);
}

/** Global disable. Writes ~/.kadai/disabled — affects every kadai project for this user. */
export function setGloballyDisabled(reason?: string): void {
  writeFlagFile(globalDisabledPath(), reason);
}

/** Global clear. Removes ~/.kadai/disabled. Idempotent. */
export function clearGloballyDisabled(): void {
  const path = globalDisabledPath();
  if (!existsSync(path)) return;
  unlinkSync(path);
}

export function isGloballyDisabled(): boolean {
  return isEnvDisabled() || existsSync(globalDisabledPath());
}

/** Returns the most relevant disabled source's info. Composite scope when both
 *  project and global flags are set. Env wins for the `scope` field display
 *  because it's the loudest signal for the current shell. */
export function getDisabledInfo(rootDir: string): DisabledInfo | null {
  const env = isEnvDisabled();
  const global = readFlagFile(globalDisabledPath());
  const project = readFlagFile(projectDisabledPath(rootDir));

  if (!env && !global && !project) return null;

  // Determine scope.
  let scope: DisabledScope;
  if (env) scope = "env";
  else if (global && project) scope = "both";
  else if (global) scope = "global";
  else scope = "project";

  // When env disables, surface the env reason explicitly — even if files exist.
  // The env var is the loudest signal for the current shell and a user reading
  // this should know to `unset` it, not chase the file message.
  if (env) {
    return { scope, since: new Date(0).toISOString(), reason: `${ENV_DISABLED_FLAG}=1 in environment` };
  }
  // Project wins over global when both file sources exist (more local, more specific).
  const source = project ?? global;
  return source!
    ? { scope, since: source.since, ...(source.reason ? { reason: source.reason } : {}) }
    : { scope, since: new Date(0).toISOString() };
}

/** Check the disabled flag (any source). If disabled, print a friendly error
 *  message and exit(1). Used at the top of mutating CLI command actions. If
 *  not in a kadai project, returns silently (let the command's own error
 *  handling fire). */
export function assertEnabled(): void {
  const root = findKadaiRoot(process.cwd());
  if (!root) return;
  if (!isDisabled(root)) return;
  const info = getDisabledInfo(root);
  const scopeStr = info?.scope === "env"
    ? `via ${ENV_DISABLED_FLAG}=1 environment variable`
    : info?.scope === "global"
      ? `globally (${globalDisabledPath()})`
      : info?.scope === "both"
        ? `globally + in this project`
        : `in this project`;
  const reason = info?.reason ? ` reason: ${info.reason}.` : "";
  const fix = info?.scope === "env"
    ? `Unset ${ENV_DISABLED_FLAG} to re-enable.`
    : info?.scope === "global"
      ? `Run \`kadai enable --global\` to re-enable.`
      : info?.scope === "both"
        ? `Run \`kadai enable\` AND \`kadai enable --global\` to re-enable.`
        : `Run \`kadai enable\` to re-enable.`;
  process.stderr.write(`kadai is disabled ${scopeStr} (since ${info?.since}).${reason} ${fix}\n`);
  process.exit(1);
}
