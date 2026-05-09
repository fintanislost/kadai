import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { writeFileAtomic } from "./files";
import { findKadaiRoot } from "./find-root";

const DISABLED_FILE = ".kadai/disabled";

export interface DisabledInfo {
  since: string;
  reason?: string;
}

function disabledPath(rootDir: string): string {
  return join(rootDir, DISABLED_FILE);
}

export function isDisabled(rootDir: string): boolean {
  return existsSync(disabledPath(rootDir));
}

export function setDisabled(rootDir: string, reason?: string): void {
  const since = new Date().toISOString();
  const lines: string[] = [`disabled-since: ${since}`];
  if (reason !== undefined && reason !== "") {
    lines.push(`reason: ${reason}`);
  }
  writeFileAtomic(disabledPath(rootDir), lines.join("\n") + "\n");
}

export function clearDisabled(rootDir: string): void {
  const path = disabledPath(rootDir);
  if (!existsSync(path)) return;  // idempotent
  unlinkSync(path);
}

export function getDisabledInfo(rootDir: string): DisabledInfo | null {
  const path = disabledPath(rootDir);
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, "utf8");
  const since = raw.match(/^disabled-since:\s*(.+)$/m)?.[1]?.trim() ?? new Date(0).toISOString();
  const reasonMatch = raw.match(/^reason:\s*(.+)$/m);
  const reason = reasonMatch?.[1]?.trim();
  return reason ? { since, reason } : { since };
}


/** Check the disabled flag for the project containing process.cwd(). If disabled,
 *  print a friendly error message and exit(1). Used at the top of mutating CLI
 *  command actions. If not in a kadai project, returns silently (let the command's
 *  own error handling fire). */
export function assertEnabled(): void {
  const root = findKadaiRoot(process.cwd());
  if (!root) return;  // not in a kadai project; let the command's own error handling fire
  if (!isDisabled(root)) return;
  const info = getDisabledInfo(root);
  const reason = info?.reason ? ` reason: ${info.reason}` : '';
  process.stderr.write(`kadai is disabled in this project (since ${info?.since};${reason}). Run \`kadai enable\` to re-enable.\n`);
  process.exit(1);
}
