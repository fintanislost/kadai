import { Command } from 'commander';
import pc from 'picocolors';
import { homedir } from 'node:os';
import { basename } from 'node:path';
import {
  loadKnownProjects,
  registerProject,
  unregisterProject,
  type KnownProject,
} from '../core/projects';

export interface RegisterOptions {
  home?: string;
  rootDir: string;
  slug?: string;
  name?: string;
}

export function runRegister(opts: RegisterOptions): KnownProject {
  const home = opts.home ?? homedir();
  const slug = opts.slug ?? basename(opts.rootDir);
  const name = opts.name ?? slug;
  return registerProject(home, { slug, name, rootDir: opts.rootDir });
}

export interface UnregisterOptions {
  home?: string;
  slug: string;
}

export function runUnregister(opts: UnregisterOptions): void {
  const home = opts.home ?? homedir();
  unregisterProject(home, opts.slug);
}

export interface ListOptions {
  home?: string;
}

export function runListProjects(opts: ListOptions = {}): KnownProject[] {
  return loadKnownProjects(opts.home ?? homedir());
}

export const registerCommand = new Command('register')
  .description('Register a kadai-managed project for the multi-project web viewer')
  .argument('[path]', 'project root directory (default: cwd)')
  .option('--slug <slug>', 'short URL slug (default: basename of path)')
  .option('--name <name>', 'display name (default: slug)')
  .action((pathArg: string | undefined, opts: { slug?: string; name?: string }) => {
    const rootDir = pathArg ?? process.cwd();
    const entry = runRegister({ rootDir, slug: opts.slug, name: opts.name });
    console.log(pc.green(`✓ registered project "${entry.slug}" → ${entry.rootDir}`));
  });

export const listCommand = new Command('list')
  .description('List registered kadai projects')
  .action(() => {
    const list = runListProjects();
    if (list.length === 0) {
      console.log(pc.dim('No projects registered. Run `kadai serve register [path]` to add one.'));
      return;
    }
    for (const p of list) {
      console.log(`${pc.bold(p.slug.padEnd(20))} ${pc.dim(p.addedAt)}  ${p.name}  ${pc.dim(p.rootDir)}`);
    }
  });

export const unregisterCommand = new Command('unregister')
  .description('Unregister a project (does NOT delete its .kadai/)')
  .argument('<slug>', 'slug to remove')
  .action((slug: string) => {
    runUnregister({ slug });
    console.log(pc.green(`✓ unregistered project "${slug}"`));
  });
