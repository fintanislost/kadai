import { appendFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { findById } from '../../core/spine';
import { readPicked } from '../../core/picked';
import { registerTool } from '../registry';

export function recordChange(rootDir: string, message: string): { story_id: string; appended: string } {
  const pickedId = readPicked(rootDir);
  if (!pickedId) throw new Error('Cannot record change: no story is picked.');
  const story = findById(rootDir, pickedId);
  if (!story) throw new Error(`Picked story not found: ${pickedId}`);

  const ts = new Date().toISOString();
  const line = `- ${ts} \`note\` ${message}\n`;
  const path = join(dirname(story.path), 'changelog.md');
  appendFileSync(path, line, 'utf8');
  return { story_id: pickedId, appended: line.trim() };
}

export function registerRecordChangeTool(): void {
  registerTool({
    name: 'record_change',
    description: 'Append a free-text annotation to the picked story\'s changelog.md. Use for decisions, blockers, and design notes that don\'t naturally land via Edit/Write hook capture. Distinct line shape (`note` prefix) from hook-written and sync-written entries.',
    inputSchema: z.object({
      message: z.string().min(1, 'message must be non-empty'),
    }),
    handler: async (args, ctx) => {
      return recordChange(ctx.rootDir, args.message);
    },
  });
}
