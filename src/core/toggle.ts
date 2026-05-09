import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { writeFileAtomic } from "./files";

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
