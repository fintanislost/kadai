import { test, expect } from 'bun:test';
import { getCommand } from '../../src/cli/get';

test('getCommand has expected name and description', () => {
  expect(getCommand.name()).toBe('get');
  expect(getCommand.description()).toMatch(/by ID/i);
});
