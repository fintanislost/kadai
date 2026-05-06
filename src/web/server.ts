import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { handleApi } from './api';
import { EventBus, startWatcher as startFsWatcher } from './events';

interface EmbeddedAsset {
  encoding: 'text' | 'base64';
  content: string;
}

let embeddedAssetsCache: Record<string, EmbeddedAsset> | null = null;
async function getEmbeddedAssets(): Promise<Record<string, EmbeddedAsset>> {
  if (embeddedAssetsCache) return embeddedAssetsCache;
  try {
    const mod = await import('./embedded-assets.generated') as { EMBEDDED_ASSETS: Record<string, EmbeddedAsset> };
    embeddedAssetsCache = mod.EMBEDDED_ASSETS;
  } catch {
    embeddedAssetsCache = {};
  }
  return embeddedAssetsCache;
}

export interface ServerOptions {
  rootDir: string;
  port: number;
  distDir?: string;
  eventBus?: EventBus;
  startWatcher?: boolean;  // default true
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
  // Pre-load filesystem index.html if present; embedded path will override at request time.
  const distExists = existsSync(distDir);
  const indexHtml = distExists ? readFileSync(join(distDir, 'index.html'), 'utf8') : '';
  // Soft-check: warn (not throw) if neither embedded nor filesystem assets are usable.
  // The actual missing-asset error surfaces on first request.
  if (!distExists) {
    // Try a quick async check — if the embedded module is also empty, log a warning.
    getEmbeddedAssets().then(embedded => {
      if (Object.keys(embedded).length === 0) {
        console.warn('⚠ Kadai web viewer: no assets found (no src/web/dist/ and no embedded module). Run `bun run build:web` and re-launch.');
      }
    });
  }

  const bus = opts.eventBus ?? new EventBus();
  const stopWatcher = (opts.startWatcher !== false)
    ? startFsWatcher(opts.rootDir, bus)
    : () => {};

  const server = Bun.serve({
    port: opts.port,
    async fetch(req) {
      const url = new URL(req.url);
      const path = url.pathname;

      if (path.startsWith('/api/')) {
        return handleApi(req, opts.rootDir, bus);
      }

      // SPA serving: prefer embedded; fall back to filesystem.
      const embedded = await getEmbeddedAssets();
      const embeddedAsset = embedded[path];
      if (embeddedAsset) {
        const body = embeddedAsset.encoding === 'base64'
          ? Uint8Array.from(atob(embeddedAsset.content), c => c.charCodeAt(0))
          : embeddedAsset.content;
        return new Response(body, { headers: { 'Content-Type': mimeFor(path) } });
      }

      if (path !== '/' && existsSync(join(distDir, path))) {
        const file = Bun.file(join(distDir, path));
        return new Response(file, { headers: { 'Content-Type': mimeFor(path) } });
      }

      // SPA fallback: serve index (embedded if present, else from disk).
      const indexEmbedded = embedded['/index.html'];
      if (indexEmbedded) {
        return new Response(indexEmbedded.content, { headers: { 'Content-Type': MIME['.html'] } });
      }
      return new Response(indexHtml, { headers: { 'Content-Type': MIME['.html'] } });
    },
  });

  return {
    port: server.port!,
    url: `http://localhost:${server.port}`,
    stop: async () => { stopWatcher(); server.stop(); },
  };
}
