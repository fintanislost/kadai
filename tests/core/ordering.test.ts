import { test, expect } from 'bun:test';
import { nextOrder, orderAfter, redensify, needsRedensify } from '../../src/core/ordering';

test('nextOrder on empty list returns 10', () => {
  expect(nextOrder([])).toBe(10);
});

test('nextOrder returns max + 10', () => {
  expect(nextOrder([{ order: 10 }, { order: 30 }, { order: 50 }])).toBe(60);
});

test('orderAfter computes midpoint', () => {
  const items = [{ order: 10 }, { order: 30 }, { order: 50 }];
  expect(orderAfter(items, 10)).toBe(20);
  expect(orderAfter(items, 30)).toBe(40);
});

test('orderAfter on last item returns +10', () => {
  expect(orderAfter([{ order: 10 }, { order: 30 }], 30)).toBe(40);
});

test('orderAfter throws for unknown order', () => {
  expect(() => orderAfter([{ order: 10 }], 99)).toThrow(/No item with order=99/);
});

test('redensify reassigns to 10, 20, 30 in current sorted order', () => {
  const items = [{ order: 1 }, { order: 5 }, { order: 100 }];
  expect(redensify(items)).toEqual([{ order: 10 }, { order: 20 }, { order: 30 }]);
});

test('needsRedensify true when gap < 2', () => {
  expect(needsRedensify([{ order: 10 }, { order: 11 }])).toBe(true);
});

test('needsRedensify false with healthy gaps', () => {
  expect(needsRedensify([{ order: 10 }, { order: 20 }])).toBe(false);
});
