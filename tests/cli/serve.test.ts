import { test, expect } from 'bun:test';
import { serveCommand } from '../../src/cli/serve';

test('serveCommand has expected name and options', () => {
  expect(serveCommand.name()).toBe('serve');
  const optionFlags = serveCommand.options.map(o => o.long);
  expect(optionFlags).toContain('--port');
  expect(optionFlags).toContain('--no-open');
});
