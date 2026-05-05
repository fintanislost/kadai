import { test, expect } from 'bun:test';
import { mcpCommand } from '../../src/cli/mcp';

test('mcpCommand has the expected name and description', () => {
  expect(mcpCommand.name()).toBe('mcp');
  expect(mcpCommand.description()).toContain('MCP');
});
