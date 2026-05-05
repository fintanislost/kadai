import { Command } from 'commander';
import pc from 'picocolors';
import { loadConfig, saveConfig } from '../config/load';

function getNested(obj: unknown, path: string[]): unknown {
  let cur: any = obj;
  for (const segment of path) {
    if (cur === undefined || cur === null) return undefined;
    cur = cur[segment];
  }
  return cur;
}

function setNested(obj: any, path: string[], value: unknown): void {
  let cur = obj;
  for (let i = 0; i < path.length - 1; i++) {
    if (cur[path[i]] === undefined) cur[path[i]] = {};
    cur = cur[path[i]];
  }
  cur[path[path.length - 1]] = value;
}

function coerce(existing: unknown, raw: string): unknown {
  if (typeof existing === 'boolean') return raw === 'true';
  if (typeof existing === 'number') return Number(raw);
  return raw;
}

export function getConfigKey(rootDir: string, key: string): unknown {
  const cfg = loadConfig(rootDir);
  const path = key.split('.');
  const v = getNested(cfg, path);
  if (v === undefined) throw new Error(`Unknown config key: ${key}`);
  return v;
}

export function setConfigKey(rootDir: string, key: string, rawValue: string): void {
  const cfg = loadConfig(rootDir);
  const path = key.split('.');
  const existing = getNested(cfg, path);
  if (existing === undefined) throw new Error(`Unknown config key: ${key}`);
  setNested(cfg, path, coerce(existing, rawValue));
  saveConfig(rootDir, cfg);
}

export const configCommand = new Command('config')
  .description('Read or write a config key (e.g. "change_capture.enabled" or "change_capture.enabled=false")')
  .argument('<expr>', 'KEY or KEY=VALUE')
  .action((expr: string) => {
    const eq = expr.indexOf('=');
    const rootDir = process.cwd();
    if (eq === -1) {
      console.log(JSON.stringify(getConfigKey(rootDir, expr)));
    } else {
      const key = expr.slice(0, eq);
      const value = expr.slice(eq + 1);
      setConfigKey(rootDir, key, value);
      console.log(pc.green(`✓ set ${key}=${value}`));
    }
  });
