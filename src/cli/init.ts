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

export const initCommand = new Command('init')
  .description('Bootstrap a kadai spine in the current directory')
  .option('-y, --yes', 'skip prompts; use defaults')
  .action(async (opts: { yes?: boolean }) => {
    const rootDir = process.cwd();
    let productDescription = '';
    if (opts.yes) {
      productDescription = 'Untitled product';
    } else {
      const r = await prompts({
        type: 'text',
        name: 'productDescription',
        message: 'What is the product you are tracking?',
        initial: 'Untitled product',
      });
      productDescription = r.productDescription ?? 'Untitled product';
    }
    runInit({ rootDir, productDescription, skipFirstEpic: true });
    console.log(pc.green('✓ kadai initialized in ' + rootDir));
    console.log('  - .kadai/ created with config + README');
    console.log('  - CLAUDE.md updated with kadai section');
    console.log('Next: ' + pc.cyan('kadai add epic'));
  });
