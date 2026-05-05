import { test, expect } from 'bun:test';
import { validateFrontmatter, safeValidateFrontmatter } from '../../src/core/schema';

const baseEpic = {
  id: 'EPIC-001',
  title: 'Auth',
  status: 'ready',
  phase: 'mvp',
  order: 10,
  created: '2026-05-05',
  updated: '2026-05-05',
};

test('validateFrontmatter accepts valid epic', () => {
  expect(() => validateFrontmatter('epic', baseEpic)).not.toThrow();
});

test('validateFrontmatter rejects wrong id prefix', () => {
  expect(() => validateFrontmatter('epic', { ...baseEpic, id: 'FEAT-001' })).toThrow();
});

test('validateFrontmatter rejects missing parent on feature', () => {
  const feat = { ...baseEpic, id: 'FEAT-001' };
  expect(() => validateFrontmatter('feature', feat)).toThrow();
});

test('validateFrontmatter accepts story with acceptance_criteria', () => {
  const story = {
    ...baseEpic,
    id: 'STORY-001',
    parent: 'FEAT-001',
    acceptance_criteria: ['Form submits', 'Redirects on success'],
  };
  expect(() => validateFrontmatter('story', story)).not.toThrow();
});

test('validateFrontmatter rejects invalid status', () => {
  expect(() => validateFrontmatter('epic', { ...baseEpic, status: 'shipped' })).toThrow();
});

test('safeValidateFrontmatter returns success: false on bad input', () => {
  const r = safeValidateFrontmatter('epic', { ...baseEpic, id: 'BAD' });
  expect(r.success).toBe(false);
});

test('safeValidateFrontmatter returns success: true on good input', () => {
  const r = safeValidateFrontmatter('epic', baseEpic);
  expect(r.success).toBe(true);
});

test('task does not require phase or order (inherits from story)', () => {
  const task = {
    id: 'TASK-001',
    parent: 'STORY-001',
    title: 'bcrypt',
    status: 'ready',
    created: '2026-05-05',
    updated: '2026-05-05',
  };
  expect(() => validateFrontmatter('task', task)).not.toThrow();
});
