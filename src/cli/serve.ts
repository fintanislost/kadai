import { Command } from 'commander';
import pc from 'picocolors';
import { spawn } from 'node:child_process';
import { startServer } from '../web/server';
import { registerCommand, listCommand, unregisterCommand } from './serve-projects';
import { loadKnownProjects } from '../core/projects';

function openBrowser(url: string): void {
  const opener =
    process.platform === 'darwin' ? 'open' :
    process.platform === 'win32' ? 'start' :
    'xdg-open';
  const child = spawn(opener, [url], { detached: true, stdio: 'ignore' });
  child.unref();
}

export const serveCommand = new Command('serve')
  .description('Start the kadai web viewer at localhost')
  .option('-p, --port <n>', 'port (default: 0 = ephemeral)', (v) => parseInt(v, 10), 0)
  .option('--no-open', 'do not open the browser automatically')
  .option('--single', 'force single-project mode regardless of the registry')
  .option('--project <slug>', 'open the picker pre-selected to a specific project (multi-project mode only)')
  .action(async (opts: { port: number; open: boolean; single?: boolean; project?: string }) => {
    const known = opts.single ? [] : loadKnownProjects();
    const isMulti = known.length > 0;
    const handle = await startServer({
      rootDir: process.cwd(),
      port: opts.port,
      projects: isMulti ? known.map(p => ({ slug: p.slug, name: p.name, rootDir: p.rootDir })) : undefined,
    });
    const modeNote = isMulti ? ` (multi-project: ${known.length} project${known.length === 1 ? '' : 's'})` : '';
    console.log(pc.green(`✓ kadai web viewer running at ${handle.url}${modeNote}`));
    const url = opts.project && isMulti ? `${handle.url}/p/${opts.project}/` : handle.url;
    if (opts.open !== false) openBrowser(url);
    process.on('SIGINT', async () => {
      await handle.stop();
      process.exit(0);
    });
  });

serveCommand.addCommand(registerCommand);
serveCommand.addCommand(listCommand);
serveCommand.addCommand(unregisterCommand);
