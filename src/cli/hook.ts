import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { Command } from 'commander';
import { loadConfig } from '../config/load';
import { readPicked } from '../core/picked';
import { findById } from '../core/spine';
import { findKadaiRoot } from '../core/find-root';

export interface PreToolUseInput {
  tool_name: string;
  tool_input: { file_path?: string };
}

export interface EvaluationResult {
  allow: boolean;
  message?: string;
}

const GUARDED_TOOLS = new Set(['Edit', 'Write']);

function isPathAllowed(rootDir: string, targetPath: string, allowed: string[]): boolean {
  const rel = relative(rootDir, targetPath);
  if (rel === '' || rel.startsWith('..')) return true;
  if (rel === '.kadai' || rel.startsWith('.kadai/')) return true;
  for (const pattern of allowed) {
    if (pattern.endsWith('/')) {
      if (rel === pattern.slice(0, -1) || rel.startsWith(pattern)) return true;
    } else {
      if (rel === pattern) return true;
    }
  }
  return false;
}

function appendBypassLog(rootDir: string, targetPath: string, reason: string): void {
  const logPath = join(rootDir, '.kadai', 'bypass.log');
  mkdirSync(join(rootDir, '.kadai'), { recursive: true });
  const ts = new Date().toISOString();
  const reasonPart = reason ? ` reason="${reason.replace(/"/g, '\\"')}"` : '';
  appendFileSync(logPath, `${ts} ${targetPath}${reasonPart}\n`, 'utf8');
}

export function evaluatePreToolUse(input: PreToolUseInput, rootDir: string): EvaluationResult {
  if (!GUARDED_TOOLS.has(input.tool_name)) return { allow: true };
  const filePath = input.tool_input.file_path;
  if (!filePath) return { allow: true };

  const config = loadConfig(rootDir);
  if (isPathAllowed(rootDir, filePath, config.guardrail.allowed_paths)) {
    return { allow: true };
  }

  const picked = readPicked(rootDir);
  if (picked) return { allow: true };

  if (process.env.KADAI_BYPASS === '1') {
    appendBypassLog(rootDir, filePath, process.env.KADAI_BYPASS_REASON ?? '');
    return { allow: true };
  }

  return {
    allow: false,
    message:
      `Kadai guardrail: edit to "${relative(rootDir, filePath)}" blocked because no story is picked.\n` +
      `To proceed:\n` +
      `  - Pick a story:  kadai pick <story-id>\n` +
      `  - Or add the path to [guardrail.allowed_paths] in .kadai/config.toml\n` +
      `  - Or set KADAI_BYPASS=1 (with optional KADAI_BYPASS_REASON="...") for one-off escapes`,
  };
}

export interface PostToolUseInput {
  tool_name: string;
  tool_input: { file_path?: string };
}

export function recordPostToolUse(input: PostToolUseInput, rootDir: string): void {
  if (!GUARDED_TOOLS.has(input.tool_name)) return;
  const filePath = input.tool_input.file_path;
  if (!filePath) return;

  const config = loadConfig(rootDir);
  if (!config.change_capture.enabled) return;

  const picked = readPicked(rootDir);
  if (!picked) return;

  const story = findById(rootDir, picked);
  if (!story) return;

  const changelogPath = join(dirname(story.path), 'changelog.md');
  const ts = new Date().toISOString();
  const rel = relative(rootDir, filePath);
  appendFileSync(changelogPath, `- ${ts} \`${input.tool_name}\` ${rel}\n`, 'utf8');
}

async function readStdinJson<T>(): Promise<T> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', () => {
      try { resolve(JSON.parse(data) as T); } catch (e) { reject(e); }
    });
    process.stdin.on('error', reject);
  });
}

export const hookCommand = new Command('hook')
  .description('Hooks invoked by Claude Code (not for direct use)');

hookCommand
  .command('pre-tool-use')
  .description('PreToolUse hook: blocks edits outside the spine when no story is picked')
  .action(async () => {
    const root = findKadaiRoot(process.cwd());
    if (!root) process.exit(0);
    const input = await readStdinJson<PreToolUseInput>();
    const result = evaluatePreToolUse(input, root);
    if (result.allow) {
      process.exit(0);
    } else {
      if (result.message) process.stderr.write(result.message + '\n');
      process.exit(2);
    }
  });

hookCommand
  .command('post-tool-use')
  .description('PostToolUse hook: appends edits to active story changelog')
  .action(async () => {
    const root = findKadaiRoot(process.cwd());
    if (!root) process.exit(0);
    const input = await readStdinJson<PostToolUseInput>();
    recordPostToolUse(input, root);
    process.exit(0);
  });
