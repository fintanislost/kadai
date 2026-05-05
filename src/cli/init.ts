import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Command } from 'commander';
import pc from 'picocolors';
import prompts from 'prompts';
import { saveConfig } from '../config/load';
import { DEFAULT_CONFIG } from '../config/defaults';
import { writeFileAtomic } from '../core/files';

export interface InitOptions {
  rootDir: string;
  productDescription: string;
  skipFirstEpic: boolean;
}

const KADAI_GITIGNORE = `.picked
bypass.log
`;

const CLAUDE_KADAI_SECTION = `## Kadai

This project uses kadai for product/feature/story tracking (spine in \`.kadai/\`).
Use the \`kadai\` CLI to read/update the spine — direct edits to \`.kadai/\` are allowed but \`kadai add\` validates schema and increments IDs.

Run \`kadai status\` to see the picked story and queue.
`;

function readmeContent(productDescription: string): string {
  return `# Product spine\n\n**Product:** ${productDescription}\n\nThis directory is the kadai spine — the source of truth for what this product should do.\n\n- \`epics/\` — top-level capability areas, each with \`features/\` and below them \`stories/\` and \`tasks/\`\n- \`config.toml\` — phases, auto-transition flags, guardrail allowlist\n- \`.counters.json\` — ID counters (committed)\n\nDon't edit by hand if you're not sure of the schema; use \`kadai add (epic|feature|story|task)\`.\n`;
}

export function runInit(opts: InitOptions): void {
  const kadaiDir = join(opts.rootDir, '.kadai');
  mkdirSync(join(kadaiDir, 'epics'), { recursive: true });

  if (!existsSync(join(kadaiDir, 'config.toml'))) {
    saveConfig(opts.rootDir, DEFAULT_CONFIG);
  }
  if (!existsSync(join(kadaiDir, 'README.md'))) {
    writeFileAtomic(join(kadaiDir, 'README.md'), readmeContent(opts.productDescription));
  }
  if (!existsSync(join(kadaiDir, '.gitignore'))) {
    writeFileAtomic(join(kadaiDir, '.gitignore'), KADAI_GITIGNORE);
  }

  appendKadaiSectionToClaudeMd(opts.rootDir);
  mergeKadaiIntoMcpJson(opts.rootDir);
  mergeKadaiHooksIntoSettingsJson(opts.rootDir);
}

function appendKadaiSectionToClaudeMd(rootDir: string): void {
  const path = join(rootDir, 'CLAUDE.md');
  let existing = '';
  if (existsSync(path)) {
    existing = readFileSync(path, 'utf8');
    if (existing.includes('## Kadai')) return;
  }
  const sep = existing && !existing.endsWith('\n') ? '\n\n' : existing ? '\n' : '';
  writeFileAtomic(path, existing + sep + CLAUDE_KADAI_SECTION);
}

function mergeKadaiIntoMcpJson(rootDir: string): void {
  const path = join(rootDir, '.mcp.json');
  let parsed: { mcpServers?: Record<string, unknown> } = {};
  if (existsSync(path)) {
    try {
      parsed = JSON.parse(readFileSync(path, 'utf8'));
    } catch {
      parsed = {};
    }
  }
  if (!parsed.mcpServers) parsed.mcpServers = {};
  if (!parsed.mcpServers.kadai) {
    parsed.mcpServers.kadai = { command: 'kadai', args: ['mcp'] };
    writeFileAtomic(path, JSON.stringify(parsed, null, 2) + '\n');
  }
}

function mergeKadaiHooksIntoSettingsJson(rootDir: string): void {
  const path = join(rootDir, '.claude', 'settings.json');
  let parsed: { hooks?: Record<string, Array<{ matcher?: string; hooks?: Array<{ type?: string; command?: string }> }>> } = {};
  if (existsSync(path)) {
    try { parsed = JSON.parse(readFileSync(path, 'utf8')); } catch { parsed = {}; }
  }
  if (!parsed.hooks) parsed.hooks = {};
  if (!parsed.hooks.PreToolUse) parsed.hooks.PreToolUse = [];
  if (!parsed.hooks.PostToolUse) parsed.hooks.PostToolUse = [];

  const hasPre = parsed.hooks.PreToolUse.some(entry =>
    entry.hooks?.some(h => h.command === 'kadai hook pre-tool-use'));
  if (!hasPre) {
    parsed.hooks.PreToolUse.push({
      matcher: 'Edit|Write',
      hooks: [{ type: 'command', command: 'kadai hook pre-tool-use' }],
    });
  }

  const hasPost = parsed.hooks.PostToolUse.some(entry =>
    entry.hooks?.some(h => h.command === 'kadai hook post-tool-use'));
  if (!hasPost) {
    parsed.hooks.PostToolUse.push({
      matcher: 'Edit|Write',
      hooks: [{ type: 'command', command: 'kadai hook post-tool-use' }],
    });
  }

  if (!hasPre || !hasPost) {
    mkdirSync(join(rootDir, '.claude'), { recursive: true });
    writeFileAtomic(path, JSON.stringify(parsed, null, 2) + '\n');
  }
}

export const initCommand = new Command('init')
  .description('Bootstrap a kadai spine in the current directory')
  .option('-y, --yes', 'skip prompts; use defaults; no first epic')
  .action(async (opts: { yes?: boolean }) => {
    const rootDir = process.cwd();
    let productDescription = 'Untitled product';
    let createFirstEpic = false;
    let firstEpicTitle = '';

    if (!opts.yes) {
      const r1 = await prompts({
        type: 'text',
        name: 'productDescription',
        message: 'What is the product you are tracking?',
        initial: 'Untitled product',
      });
      productDescription = r1.productDescription ?? 'Untitled product';

      const r2 = await prompts({
        type: 'confirm',
        name: 'createFirstEpic',
        message: 'Want to create your first epic now?',
        initial: true,
      });
      createFirstEpic = !!r2.createFirstEpic;

      if (createFirstEpic) {
        const r3 = await prompts({
          type: 'text',
          name: 'firstEpicTitle',
          message: 'First epic title:',
          initial: 'Project setup',
        });
        firstEpicTitle = r3.firstEpicTitle ?? 'Project setup';
      }
    }

    runInit({ rootDir, productDescription, skipFirstEpic: !createFirstEpic });
    console.log(pc.green('✓ kadai initialized in ' + rootDir));

    if (createFirstEpic && firstEpicTitle) {
      // @ts-ignore
      const { runAdd } = await import('./add');
      runAdd({
        rootDir,
        kind: 'epic',
        title: firstEpicTitle,
        phase: DEFAULT_CONFIG.phases[0].slug,
      });
      console.log(pc.green('✓ first epic created'));
    }
    console.log('Next: ' + pc.cyan('kadai add feature'));
  });
