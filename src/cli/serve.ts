import { Command } from 'commander';
import pc from 'picocolors';
import { spawn } from 'node:child_process';
import { startServer } from '../web/server';

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
  .action(async (opts: { port: number; open: boolean }) => {
    const handle = await startServer({ rootDir: process.cwd(), port: opts.port });
    console.log(pc.green(`✓ kadai web viewer running at ${handle.url}`));
    if (opts.open !== false) openBrowser(handle.url);
    process.on('SIGINT', async () => {
      await handle.stop();
      process.exit(0);
    });
  });
