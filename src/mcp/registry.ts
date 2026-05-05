import type { ToolDef } from './types';

let tools: ToolDef[] = [];

export function registerTool(def: ToolDef): void {
  if (tools.some(t => t.name === def.name)) {
    throw new Error(`Duplicate tool name: ${def.name}`);
  }
  tools.push(def);
}

export function listTools(): ToolDef[] {
  return [...tools];
}

export function getTool(name: string): ToolDef | undefined {
  return tools.find(t => t.name === name);
}

/** Test-only: reset the registry. Not exported for production use. */
export function _resetRegistry(): void {
  tools = [];
}
