import { test, expect, beforeAll, afterAll } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { runInit } from '../../src/cli/init';

const REPO_ROOT = '/home/fintan/repos/kadai';
const CLI_PATH = join(REPO_ROOT, 'src/cli/index.ts');

let tmp: string;
let client: Client;
let transport: StdioClientTransport;

beforeAll(async () => {
  tmp = mkdtempSync(join(tmpdir(), 'kadai-mcp-int-'));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  transport = new StdioClientTransport({
    command: 'bun',
    args: ['run', CLI_PATH, 'mcp'],
    cwd: tmp,
  });
  client = new Client({ name: 'kadai-int-test', version: '0.1.0' }, { capabilities: {} });
  await client.connect(transport);
});

afterAll(async () => {
  await client.close();
  rmSync(tmp, { recursive: true, force: true });
});

test('listTools returns all 18 expected MCP tools', async () => {
  const { tools } = await client.listTools();
  const names = tools.map(t => t.name).sort();
  expect(names).toEqual([
    'attach_plan', 'attach_spec',
    'create_epic', 'create_feature', 'create_story', 'create_task',
    'get', 'get_active_story',
    'list_epics', 'list_features', 'list_phases', 'list_stories', 'list_tasks',
    'pick_story', 'search', 'set_phase', 'set_status', 'unpick',
  ]);
});

test('create_epic + get round-trips through the wire', async () => {
  const created = await client.callTool({
    name: 'create_epic',
    arguments: { title: 'Wire test', phase: 'mvp', description: 'from int test' },
  });
  expect(created.isError).toBeUndefined();
  const epicId = JSON.parse((created.content as any[])[0].text as string).id;
  expect(epicId).toMatch(/^EPIC-\d+$/);

  const got = await client.callTool({
    name: 'get',
    arguments: { id: epicId },
  });
  expect(got.isError).toBeUndefined();
  const item = JSON.parse((got.content as any[])[0].text as string);
  expect(item.data.title).toBe('Wire test');
});

test('illegal status transition returns isError true with message', async () => {
  // Create a story we can attempt an illegal transition on
  const epic = await client.callTool({ name: 'create_epic', arguments: { title: 'E', phase: 'mvp', description: '' } });
  const epicId = JSON.parse((epic.content as any[])[0].text as string).id;
  const feat = await client.callTool({
    name: 'create_feature',
    arguments: { title: 'F', phase: 'mvp', description: '', parent_epic: epicId },
  });
  const featId = JSON.parse((feat.content as any[])[0].text as string).id;
  const story = await client.callTool({
    name: 'create_story',
    arguments: { title: 'S', phase: 'mvp', description: '', parent_feature: featId },
  });
  const storyId = JSON.parse((story.content as any[])[0].text as string).id;

  // ready → done is illegal
  const bad = await client.callTool({ name: 'set_status', arguments: { id: storyId, status: 'done' } });
  expect(bad.isError).toBe(true);
  expect((bad.content as any[])[0].text).toMatch(/illegal/i);
});
