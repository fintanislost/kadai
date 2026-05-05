export type Status = 'backlog' | 'ready' | 'in_progress' | 'blocked' | 'review' | 'done' | 'cancelled';
export type ItemKind = 'epic' | 'feature' | 'story' | 'task';

export interface PhaseConfig {
  slug: string;
  display: string;
  color: string;
}

export interface BaseFrontmatter {
  id: string;
  title: string;
  status: Status;
  created: string;
  updated: string;
}

export interface OrderedFrontmatter extends BaseFrontmatter {
  phase: string;
  order: number;
}

export interface FeatureFrontmatter extends OrderedFrontmatter {
  parent: string;
  spec?: string;
}

export interface StoryFrontmatter extends OrderedFrontmatter {
  parent: string;
  spec?: string;
  plan?: string;
  acceptance_criteria?: string[];
}

export interface TaskFrontmatter extends BaseFrontmatter {
  parent: string;
  plan_step?: number;
}

export type AnyFrontmatter = OrderedFrontmatter | FeatureFrontmatter | StoryFrontmatter | TaskFrontmatter;

export interface Item<F extends AnyFrontmatter = AnyFrontmatter> {
  kind: ItemKind;
  path: string;
  data: F;
  body: string;
}
