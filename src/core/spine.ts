import { readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { readItem } from './reader';
import type { Item } from './types';

export function walkSpine(rootDir: string): Item[] {
  const kadaiDir = join(rootDir, '.kadai');
  if (!existsSync(kadaiDir)) return [];
  const items: Item[] = [];
  walkEpics(join(kadaiDir, 'epics'), items);
  return items;
}

function walkEpics(dir: string, out: Item[]) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir).sort()) {
    const epicDir = join(dir, entry);
    if (!statSync(epicDir).isDirectory()) continue;
    const epicFile = join(epicDir, 'epic.md');
    if (existsSync(epicFile)) {
      out.push(readItem(epicFile));
      walkFeatures(join(epicDir, 'features'), out);
    }
  }
}

function walkFeatures(dir: string, out: Item[]) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir).sort()) {
    const featureDir = join(dir, entry);
    if (!statSync(featureDir).isDirectory()) continue;
    const featureFile = join(featureDir, 'feature.md');
    if (existsSync(featureFile)) {
      out.push(readItem(featureFile));
      walkStories(join(featureDir, 'stories'), out);
    }
  }
}

function walkStories(dir: string, out: Item[]) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir).sort()) {
    const storyDir = join(dir, entry);
    if (!statSync(storyDir).isDirectory()) continue;
    const storyFile = join(storyDir, 'story.md');
    if (existsSync(storyFile)) {
      out.push(readItem(storyFile));
      walkTasks(join(storyDir, 'tasks'), out);
    }
  }
}

function walkTasks(dir: string, out: Item[]) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir).sort()) {
    if (!entry.endsWith('.md')) continue;
    if (!entry.startsWith('TASK-')) continue;
    out.push(readItem(join(dir, entry)));
  }
}

export function findById(rootDir: string, id: string): Item | null {
  for (const item of walkSpine(rootDir)) {
    if (item.data.id === id) return item;
  }
  return null;
}
