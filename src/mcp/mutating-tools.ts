/**
 * The set of MCP tool names that mutate state.
 * Used by the server dispatch handler to refuse calls when kadai is disabled.
 *
 * Exported so tests and future cassette work (feature/cassette-tier) can reuse
 * the same set without re-defining it.
 */
export const MUTATING_MCP_TOOLS = new Set<string>([
  'create_epic',
  'create_feature',
  'create_story',
  'create_task',
  'attach_spec',
  'attach_plan',
  'pick_story',
  'unpick',
  'set_status',
  'set_phase',
  'record_change',
]);
