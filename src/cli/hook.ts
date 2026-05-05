import { appendFileSync, mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { loadConfig } from '../config/load';
import { readPicked } from '../core/picked';

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
