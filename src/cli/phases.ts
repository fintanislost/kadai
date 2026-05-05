import { Command } from 'commander';
import pc from 'picocolors';
import { loadConfig, saveConfig } from '../config/load';
import type { PhaseConfig } from '../config/types';

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

export function removePhase(rootDir: string, slug: string): void {
  const cfg = loadConfig(rootDir);
  const idx = cfg.phases.findIndex(p => p.slug === slug);
  if (idx === -1) throw new Error(`Phase "${slug}" not found`);
  cfg.phases.splice(idx, 1);
  saveConfig(rootDir, cfg);
}

export function renamePhase(rootDir: string, oldSlug: string, newSlug: string, newDisplay: string): void {
  const cfg = loadConfig(rootDir);
  const phase = cfg.phases.find(p => p.slug === oldSlug);
  if (!phase) throw new Error(`Phase "${oldSlug}" not found`);
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
    addPhase(process.cwd(), slug, display, color);
    console.log(pc.green(`✓ added phase ${slug}`));
  });

phasesCommand
  .command('remove')
  .argument('<slug>')
  .action((slug: string) => {
    removePhase(process.cwd(), slug);
    console.log(pc.green(`✓ removed phase ${slug}`));
  });

phasesCommand
  .command('rename')
  .argument('<oldSlug>')
  .argument('<newSlug>')
  .argument('<newDisplay>')
  .action((oldSlug: string, newSlug: string, newDisplay: string) => {
    renamePhase(process.cwd(), oldSlug, newSlug, newDisplay);
    console.log(pc.green(`✓ renamed ${oldSlug} → ${newSlug}`));
  });
