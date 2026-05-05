import { test, expect, describe } from 'bun:test';
import { isLegalTransition, legalNextStates } from '../../src/core/state-machine';

describe('state machine — universal transitions', () => {
  test('ready → in_progress is legal for any kind', () => {
    expect(isLegalTransition('epic', 'ready', 'in_progress')).toBe(true);
    expect(isLegalTransition('feature', 'ready', 'in_progress')).toBe(true);
    expect(isLegalTransition('story', 'ready', 'in_progress')).toBe(true);
    expect(isLegalTransition('task', 'ready', 'in_progress')).toBe(true);
  });

  test('backlog → done is illegal (must go through ready/in_progress)', () => {
    expect(isLegalTransition('story', 'backlog', 'done')).toBe(false);
  });

  test('done is terminal — no outgoing transitions', () => {
    expect(legalNextStates('story', 'done')).toEqual([]);
  });

  test('cancelled is terminal', () => {
    expect(legalNextStates('story', 'cancelled')).toEqual([]);
  });

  test('blocked can return to in_progress or be cancelled', () => {
    expect(legalNextStates('story', 'blocked').sort()).toEqual(['cancelled', 'in_progress']);
  });
});

describe('state machine — story-only review state', () => {
  test('story can enter review from in_progress', () => {
    expect(isLegalTransition('story', 'in_progress', 'review')).toBe(true);
  });

  test('non-story cannot enter review', () => {
    expect(isLegalTransition('feature', 'in_progress', 'review')).toBe(false);
    expect(isLegalTransition('epic', 'in_progress', 'review')).toBe(false);
    expect(isLegalTransition('task', 'in_progress', 'review')).toBe(false);
  });

  test('legalNextStates excludes review for non-stories', () => {
    expect(legalNextStates('feature', 'in_progress')).not.toContain('review');
    expect(legalNextStates('story', 'in_progress')).toContain('review');
  });
});
