export interface PhaseConfig {
  slug: string;
  display: string;
  color: string;
}

export interface AutoTransitionsConfig {
  spec_attached_marks_ready: boolean;
  plan_attached_marks_ready: boolean;
  plan_step_completion_marks_task_done: boolean;
  all_tasks_done_marks_story_review: boolean;
  pr_merge_marks_story_done: boolean;
}

export interface GuardrailConfig {
  allowed_paths: string[];
}

export interface ChangeCaptureConfig {
  enabled: boolean;
}

export interface Config {
  phases: PhaseConfig[];
  auto_transitions: AutoTransitionsConfig;
  guardrail: GuardrailConfig;
  change_capture: ChangeCaptureConfig;
}
