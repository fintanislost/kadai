import { Command } from 'commander';
import pc from 'picocolors';
import { assertEnabled } from '../core/toggle';
import { loadConfig, saveConfig } from '../config/load';
import type { PhaseConfig } from '../config/types';
import { walkSpine } from '../core/spine';
import { writeFileAtomic } from '../core/files';
import { serialize } from '../core/frontmatter';
import { getPhase } from '../core/item-helpers';
import type { Item } from '../core/types';

function rewriteItemPhase(item: Item, newPhase: string): void {
  const updated: Record<string, unknown> = {
    ...(item.data as unknown as Record<string, unknown>),
    phase: newPhase,
    updated: new Date().toISOString().slice(0, 10),
  };
  writeFileAtomic(item.path, serialize(updated, item.body));
}

export function listPhases(rootDir: string): PhaseConfig[] {
  return loadConfig(rootDir).phases;
}

export function addPhase(rootDir: string, slug: string, display: string, color: string): void {
  const cfg = loadConfig(rootDir);
  if (cfg.phases.some(p => p.slug === slug)) {
    throw new Error(`Phase "${slug}" already exists`);
  }
  cfg.phases.push({ slug, display, color });
  saveConfig(rootDir, cfg);
}

export function removePhase(rootDir: string, slug: string, opts: { moveTo?: string } = {}): void {
  const cfg = loadConfig(rootDir);
  const idx = cfg.phases.findIndex(p => p.slug === slug);
  if (idx === -1) throw new Error(`Phase "${slug}" not found`);

  const referrers = walkSpine(rootDir).filter(item => getPhase(item) === slug);
  if (referrers.length > 0) {
    if (!opts.moveTo) {
      throw new Error(
        `${referrers.length} items reference phase "${slug}" — pass --move-to <other-slug> to migrate, or move them first.`,
      );
    }
    const target = cfg.phases.find(p => p.slug === opts.moveTo);
    if (!target) throw new Error(`Target phase "${opts.moveTo}" does not exist`);
    for (const item of referrers) rewriteItemPhase(item, opts.moveTo);
  }

  cfg.phases.splice(idx, 1);
  saveConfig(rootDir, cfg);
}

export function renamePhase(rootDir: string, oldSlug: string, newSlug: string, newDisplay: string): void {
  const cfg = loadConfig(rootDir);
  const phase = cfg.phases.find(p => p.slug === oldSlug);
  if (!phase) throw new Error(`Phase "${oldSlug}" not found`);

  const referrers = walkSpine(rootDir).filter(item => getPhase(item) === oldSlug);
  for (const item of referrers) rewriteItemPhase(item, newSlug);

  phase.slug = newSlug;
  phase.display = newDisplay;
  saveConfig(rootDir, cfg);
}

export const phasesCommand = new Command('phases')
  .description('Manage phases (list/add/remove/rename)');

phasesCommand
  .command('list', { isDefault: true })
  .description('List configured phases')
  .action(() => {
    for (const p of listPhases(process.cwd())) {
      console.log(`${pc.bold(p.slug.padEnd(20))} ${pc.dim(p.color)}  ${p.display}`);
    }
  });

phasesCommand
  .command('add')
  .argument('<slug>')
  .argument('<display>')
  .argument('[color]', 'hex color', '#888888')
  .action((slug: string, display: string, color: string) => {
    assertEnabled();
    addPhase(process.cwd(), slug, display, color);
    console.log(pc.green(`✓ added phase ${slug}`));
  });

phasesCommand
  .command('remove')
  .argument('<slug>')
  .option('--move-to <slug>', 'migrate items in this phase to the target slug before removing')
  .action((slug: string, opts: { moveTo?: string }) => {
    assertEnabled();
    removePhase(process.cwd(), slug, { moveTo: opts.moveTo });
    console.log(pc.green(`✓ removed phase ${slug}${opts.moveTo ? ` (migrated to ${opts.moveTo})` : ''}`));
  });

phasesCommand
  .command('rename')
  .argument('<oldSlug>')
  .argument('<newSlug>')
  .argument('<newDisplay>')
  .action((oldSlug: string, newSlug: string, newDisplay: string) => {
    assertEnabled();
    renamePhase(process.cwd(), oldSlug, newSlug, newDisplay);
    console.log(pc.green(`✓ renamed ${oldSlug} → ${newSlug}`));
  });
