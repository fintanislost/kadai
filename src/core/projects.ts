import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { writeFileAtomic } from './files';

export interface KnownProject {
  slug: string;
  name: string;
  rootDir: string;
  addedAt: string;
}

export interface KnownProjectsFile {
  projects: KnownProject[];
}

const REGISTRY_FILENAME = 'known-projects.json';

function registryPath(home: string): string {
  return join(home, '.kadai', REGISTRY_FILENAME);
}

export function loadKnownProjects(home: string = homedir()): KnownProject[] {
  const path = registryPath(home);
  if (!existsSync(path)) return [];
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<KnownProjectsFile>;
    return Array.isArray(parsed.projects) ? parsed.projects : [];
  } catch {
    return [];
  }
}

export function saveKnownProjects(home: string = homedir(), projects: KnownProject[]): void {
  const path = registryPath(home);
  mkdirSync(join(home, '.kadai'), { recursive: true });
  const data: KnownProjectsFile = { projects };
  writeFileAtomic(path, JSON.stringify(data, null, 2) + '\n');
}

export interface RegisterInput {
  slug: string;
  name: string;
  rootDir: string;
}

export function registerProject(home: string, input: RegisterInput): KnownProject {
  const list = loadKnownProjects(home);
  if (list.some(p => p.slug === input.slug)) {
    throw new Error(`Project "${input.slug}" already registered`);
  }
  const entry: KnownProject = {
    slug: input.slug,
    name: input.name,
    rootDir: input.rootDir,
    addedAt: new Date().toISOString().slice(0, 10),
  };
  saveKnownProjects(home, [...list, entry]);
  return entry;
}

export function unregisterProject(home: string, slug: string): void {
  const list = loadKnownProjects(home);
  if (!list.some(p => p.slug === slug)) {
    throw new Error(`Project "${slug}" not registered`);
  }
  saveKnownProjects(home, list.filter(p => p.slug !== slug));
}
