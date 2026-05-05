import matter from 'gray-matter';

export interface ParsedDoc<T> {
  data: T;
  body: string;
}

export function parse<T = Record<string, unknown>>(source: string): ParsedDoc<T> {
  const { data, content } = matter(source);
  return { data: data as T, body: content };
}

export function serialize<T extends Record<string, unknown>>(data: T, body: string): string {
  return matter.stringify(body, data);
}
