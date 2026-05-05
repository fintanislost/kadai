import type { z } from 'zod';

export interface ToolContext {
  rootDir: string;
}

export interface ToolDef<Input = unknown, Output = unknown> {
  name: string;
  description: string;
  inputSchema: z.ZodType<Input>;
  handler: (input: Input, ctx: ToolContext) => Promise<Output>;
}
