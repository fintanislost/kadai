import { test, expect } from 'bun:test';
import { parse, serialize } from '../../src/core/frontmatter';

test('parse extracts YAML frontmatter and body', () => {
  const src = `---
id: STORY-001
title: Test
---

## Description

Some content.
`;
  const { data, body } = parse<{ id: string; title: string }>(src);
  expect(data.id).toBe('STORY-001');
  expect(data.title).toBe('Test');
  expect(body.trim()).toContain('## Description');
});

test('serialize roundtrips with parse', () => {
  const data = { id: 'STORY-001', title: 'Test' };
  const body = '## Description\n\nContent.\n';
  const result = serialize(data, body);
  const parsed = parse(result);
  expect(parsed.data).toEqual(data);
  expect(parsed.body.trim()).toContain('## Description');
});

test('parse handles missing frontmatter', () => {
  const { data, body } = parse('Just content, no frontmatter.');
  expect(data).toEqual({});
  expect(body).toBe('Just content, no frontmatter.');
});

test('parse handles array values in frontmatter', () => {
  const src = `---
id: STORY-001
acceptance_criteria:
  - First criterion
  - Second criterion
---
body
`;
  const { data } = parse<{ acceptance_criteria: string[] }>(src);
  expect(data.acceptance_criteria).toEqual(['First criterion', 'Second criterion']);
});
