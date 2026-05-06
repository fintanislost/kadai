import { z } from 'zod';
import { attachFile } from '../../core/attach';
import { registerTool } from '../registry';

export function registerAttachTools(): void {
  registerTool({
    name: 'attach_spec',
    description: 'Move a spec markdown file from its current location (typically docs/superpowers/specs/) into the named feature\'s directory as spec.md, and set the feature\'s frontmatter `spec` field to "spec.md". The original source file is removed after the move.',
    inputSchema: z.object({
      feature_id: z.string().regex(/^FEAT-\d+$/),
      source_path: z.string().min(1),
    }),
    handler: async (args, ctx) => {
      const result = attachFile(ctx.rootDir, args.feature_id, 'spec', args.source_path);
      return { feature_id: result.itemId, attached_at: result.targetPath };
    },
  });

  registerTool({
    name: 'attach_plan',
    description: 'Move a plan markdown file from its current location (typically docs/superpowers/plans/) into the named story\'s directory as plan.md, and set the story\'s frontmatter `plan` field to "plan.md". The original source file is removed after the move.',
    inputSchema: z.object({
      story_id: z.string().regex(/^STORY-\d+$/),
      source_path: z.string().min(1),
    }),
    handler: async (args, ctx) => {
      const result = attachFile(ctx.rootDir, args.story_id, 'plan', args.source_path);
      return { story_id: result.itemId, attached_at: result.targetPath };
    },
  });
}
