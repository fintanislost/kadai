import { existsSync, readFileSync, rmSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { Command } from 'commander';
import pc from 'picocolors';
import prompts from 'prompts';
import { writeFileAtomic } from '../core/files';

export interface UninstallOptions {
  rootDir: string;
  keepSpine: boolean;
}

const KADAI_HOOK_COMMAND_PREFIX = 'kadai hook ';

interface SettingsShape {
  hooks?: Record<string, Array<{ matcher?: string; hooks?: Array<{ type?: string; command?: string }> }>>;
}

interface McpShape {
  mcpServers?: Record<string, unknown>;
}

function uninstallSpine(rootDir: string): void {
  const dir = join(rootDir, '.kadai');
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}

function uninstallMcpEntry(rootDir: string): void {
  const path = join(rootDir, '.mcp.json');
  if (!existsSync(path)) return;
  let parsed: McpShape;
  try { parsed = JSON.parse(readFileSync(path, 'utf8')) as McpShape; } catch { return; }
  if (!parsed.mcpServers) return;
  delete parsed.mcpServers.kadai;
  if (Object.keys(parsed.mcpServers).length === 0) {
    unlinkSync(path);
  } else {
    writeFileAtomic(path, JSON.stringify(parsed, null, 2) + '\n');
  }
}

function uninstallHooks(rootDir: string): void {
  const path = join(rootDir, '.claude', 'settings.json');
  if (!existsSync(path)) return;
  let parsed: SettingsShape;
  try { parsed = JSON.parse(readFileSync(path, 'utf8')) as SettingsShape; } catch { return; }
  if (!parsed.hooks) return;

  for (const event of Object.keys(parsed.hooks)) {
    const entries = parsed.hooks[event];
    const filtered = entries.filter(entry =>
      !entry.hooks?.some(h => (h.command ?? '').startsWith(KADAI_HOOK_COMMAND_PREFIX)));
    if (filtered.length === 0) {
      delete parsed.hooks[event];
    } else {
      parsed.hooks[event] = filtered;
    }
  }

  if (Object.keys(parsed.hooks).length === 0 && Object.keys(parsed).length === 1) {
    unlinkSync(path);
  } else {
    writeFileAtomic(path, JSON.stringify(parsed, null, 2) + '\n');
  }
}

function uninstallClaudeMdSection(rootDir: string): void {
  const path = join(rootDir, 'CLAUDE.md');
  if (!existsSync(path)) return;
  const text = readFileSync(path, 'utf8');
  // Strip from "## Kadai" through end of the section (next "## " heading or EOF).
  const updated = text.replace(/(?:^|\n)## Kadai[\s\S]*?(?=\n## |\n# |$)/, '');
  if (updated !== text) {
    if (updated.trim() === '') {
      unlinkSync(path);
    } else {
      writeFileAtomic(path, updated.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n');
    }
  }
}

export function runUninstall(opts: UninstallOptions): void {
  if (!opts.keepSpine) uninstallSpine(opts.rootDir);
  uninstallMcpEntry(opts.rootDir);
  uninstallHooks(opts.rootDir);
  uninstallClaudeMdSection(opts.rootDir);
}

export const uninstallCommand = new Command('uninstall')
  .description('Remove kadai integration from the current project (inverse of init)')
  .option('--keep-spine', 'preserve the .kadai/ directory (only remove MCP/hook/CLAUDE.md entries)')
  .option('-y, --yes', 'skip the confirmation prompt')
  .action(async (opts: { keepSpine?: boolean; yes?: boolean }) => {
    const rootDir = process.cwd();
    if (!opts.yes) {
      const action = opts.keepSpine
        ? 'remove kadai MCP entries, hooks, and the CLAUDE.md section (preserves .kadai/)'
        : 'DELETE .kadai/ AND remove kadai MCP entries, hooks, and the CLAUDE.md section';
      const r = await prompts({ type: 'confirm', name: 'go', message: `This will ${action}. Proceed?`, initial: false });
      if (!r.go) {
        console.log(pc.yellow('cancelled'));
        return;
      }
    }
    runUninstall({ rootDir, keepSpine: !!opts.keepSpine });
    console.log(pc.green(opts.keepSpine ? '✓ kadai integration removed (spine preserved)' : '✓ kadai uninstalled'));
  });
