import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { handleApi } from './api';

export interface ServerOptions {
  rootDir: string;
  port: number;
  distDir?: string;
}

export interface ServerHandle {
  port: number;
  url: string;
  stop: () => Promise<void>;
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function defaultDistDir(): string {
  return resolve(import.meta.dir, 'dist');
}

function mimeFor(path: string): string {
  const ext = path.match(/\.[^.]+$/)?.[0] ?? '';
  return MIME[ext] ?? 'application/octet-stream';
}

export async function startServer(opts: ServerOptions): Promise<ServerHandle> {
  const distDir = opts.distDir ?? defaultDistDir();
  if (!existsSync(distDir)) {
    throw new Error(
      `Web viewer assets not found at ${distDir}. Run \`bun run build:web\` first.`,
    );
  }
  const indexHtml = readFileSync(join(distDir, 'index.html'), 'utf8');

  const server = Bun.serve({
    port: opts.port,
    async fetch(req) {
      const url = new URL(req.url);
      const path = url.pathname;

      if (path.startsWith('/api/')) {
        return handleApi(req, opts.rootDir);
      }

      if (path !== '/' && existsSync(join(distDir, path))) {
        const file = Bun.file(join(distDir, path));
        return new Response(file, { headers: { 'Content-Type': mimeFor(path) } });
      }

      return new Response(indexHtml, { headers: { 'Content-Type': MIME['.html'] } });
    },
  });

  return {
    port: server.port!,
    url: `http://localhost:${server.port}`,
    stop: async () => { server.stop(); },
  };
}
