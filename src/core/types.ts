import type { ItemKind, Status } from './state-machine';

export type Phase = string;

export interface BaseFrontmatter {
  id: string;
  title: string;
  status: Status;
  created: string;
  updated: string;
}

export interface OrderedFrontmatter extends BaseFrontmatter {
  phase: Phase;
  order: number;
}

export interface EpicFrontmatter extends OrderedFrontmatter {}

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

export type AnyFrontmatter =
  | EpicFrontmatter
  | FeatureFrontmatter
  | StoryFrontmatter
  | TaskFrontmatter;

export interface Item<F extends AnyFrontmatter = AnyFrontmatter> {
  kind: ItemKind;
  path: string;
  data: F;
  body: string;
}

export type Epic = Item<EpicFrontmatter>;
export type Feature = Item<FeatureFrontmatter>;
export type Story = Item<StoryFrontmatter>;
export type Task = Item<TaskFrontmatter>;
