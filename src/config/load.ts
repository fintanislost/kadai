import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseToml, stringify as stringifyToml } from 'smol-toml';
import { writeFileAtomic } from '../core/files';
import { DEFAULT_CONFIG } from './defaults';
import type { Config } from './types';

const CONFIG_FILE = 'config.toml';

export function configPath(rootDir: string): string {
  return join(rootDir, '.kadai', CONFIG_FILE);
}

export function loadConfig(rootDir: string): Config {
  const path = configPath(rootDir);
  if (!existsSync(path)) return DEFAULT_CONFIG;
  const parsed = parseToml(readFileSync(path, 'utf8')) as unknown as Partial<Config>;
  return mergeConfig(DEFAULT_CONFIG, parsed);
}

export function saveConfig(rootDir: string, config: Config): void {
  const path = configPath(rootDir);
  writeFileAtomic(path, stringifyToml(config as unknown as Record<string, unknown>));
}

function mergeConfig(base: Config, override: Partial<Config>): Config {
  return {
    phases: override.phases ?? base.phases,
    auto_transitions: { ...base.auto_transitions, ...(override.auto_transitions ?? {}) },
    guardrail: { ...base.guardrail, ...(override.guardrail ?? {}) },
    change_capture: { ...base.change_capture, ...(override.change_capture ?? {}) },
  };
}
