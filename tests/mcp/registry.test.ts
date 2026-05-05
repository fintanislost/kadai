import { test, expect, beforeEach } from 'bun:test';
import { z } from 'zod';
import { registerTool, listTools, getTool, _resetRegistry } from '../../src/mcp/registry';

beforeEach(() => { _resetRegistry(); });

test('registerTool adds a tool to the registry', () => {
  registerTool({
    name: 'test_tool',
    description: 'a test tool',
    inputSchema: z.object({}),
    handler: async () => 'ok',
  });
  expect(listTools().length).toBe(1);
  expect(listTools()[0].name).toBe('test_tool');
});

test('getTool returns the named tool', () => {
  registerTool({
    name: 'foo',
    description: 'x',
    inputSchema: z.object({}),
    handler: async () => null,
  });
  expect(getTool('foo')?.name).toBe('foo');
  expect(getTool('missing')).toBeUndefined();
});

test('registerTool rejects duplicate names', () => {
  registerTool({
    name: 'dup',
    description: 'x',
    inputSchema: z.object({}),
    handler: async () => null,
  });
  expect(() => registerTool({
    name: 'dup',
    description: 'x',
    inputSchema: z.object({}),
    handler: async () => null,
  })).toThrow(/duplicate/i);
});
