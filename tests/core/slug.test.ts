import { test, expect } from 'bun:test';
import { slugify } from '../../src/core/slug';

test('slugify lowercases and replaces spaces with dashes', () => {
  expect(slugify('User Login')).toBe('user-login');
});

test('slugify strips diacritics', () => {
  expect(slugify('café au lait')).toBe('cafe-au-lait');
});

test('slugify removes special chars', () => {
  expect(slugify('User can log in! (with email)')).toBe('user-can-log-in-with-email');
});

test('slugify trims leading/trailing dashes', () => {
  expect(slugify('  -hello-  ')).toBe('hello');
});

test('slugify truncates to 50 chars', () => {
  const long = 'a'.repeat(100);
  expect(slugify(long).length).toBe(50);
});

test('slugify collapses repeated separators', () => {
  expect(slugify('foo   ---   bar')).toBe('foo-bar');
});
