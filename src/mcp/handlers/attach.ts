import { existsSync, copyFileSync, unlinkSync } from 'node:fs';
import { dirname, join, isAbsolute, resolve } from 'node:path';
import { z } from 'zod';
import { findById } from '../../core/spine';
import { writeFileAtomic } from '../../core/files';
import { serialize } from '../../core/frontmatter';
import { registerTool } from '../registry';

function resolveSource(rootDir: string, sourcePath: string): string {
  return isAbsolute(sourcePath) ? sourcePath : resolve(rootDir, sourcePath);
}

export function registerAttachTools(): void {
  registerTool({
    name: 'attach_spec',
    description: 'Move a spec markdown file from its current location (typically docs/superpowers/specs/) into the named feature\'s directory as spec.md, and set the feature\'s frontmatter `spec` field to "spec.md". The original source file is removed after the move.',
    inputSchema: z.object({
      feature_id: z.string().regex(/^FEAT-\d+$/),
      source_path: z.string().min(1),
    }),
    handler: async (args, ctx) => {
      const feature = findById(ctx.rootDir, args.feature_id);
      if (!feature || feature.kind !== 'feature') {
        throw new Error(`Feature not found: ${args.feature_id}`);
      }
      const src = resolveSource(ctx.rootDir, args.source_path);
      if (!existsSync(src)) throw new Error(`Source spec not found: ${src}`);

      const featureDir = dirname(feature.path);
      const target = join(featureDir, 'spec.md');
      copyFileSync(src, target);
      unlinkSync(src);

      const updated: Record<string, unknown> = {
        ...feature.data,
        spec: 'spec.md',
        updated: new Date().toISOString().slice(0, 10),
      };
      writeFileAtomic(feature.path, serialize(updated, feature.body));
      return { feature_id: args.feature_id, attached_at: target };
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
      const story = findById(ctx.rootDir, args.story_id);
      if (!story || story.kind !== 'story') {
        throw new Error(`Story not found: ${args.story_id}`);
      }
      const src = resolveSource(ctx.rootDir, args.source_path);
      if (!existsSync(src)) throw new Error(`Source plan not found: ${src}`);

      const storyDir = dirname(story.path);
      const target = join(storyDir, 'plan.md');
      copyFileSync(src, target);
      unlinkSync(src);

      const updated: Record<string, unknown> = {
        ...story.data,
        plan: 'plan.md',
        updated: new Date().toISOString().slice(0, 10),
      };
      writeFileAtomic(story.path, serialize(updated, story.body));
      return { story_id: args.story_id, attached_at: target };
    },
  });
}
