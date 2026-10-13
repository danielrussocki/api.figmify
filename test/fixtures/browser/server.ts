import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { readFile } from 'node:fs/promises';

export interface BrowserFixtureServer {
  url: string;
  close(): Promise<void>;
}

const FIXTURE_FILES = new Map([
  ['/browser-fixtures.html', 'browser-fixtures.html'],
  ['/iframe.html', 'iframe.html'],
  ['/resources/fixture-image.svg', 'fixture-image.svg'],
]);

/** Starts an ephemeral local server used only by browser integration tests. */
export async function startBrowserFixtureServer(): Promise<BrowserFixtureServer> {
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://fixture.test').pathname;

    if (pathname === '/resources/failed-image.png') {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Fixture resource not found.');
      return;
    }

    if (pathname === '/resources/secondary-redirect.css') {
      response.writeHead(302, { location: '/resources/stylesheet.css' });
      response.end();
      return;
    }

    if (pathname === '/resources/stylesheet.css') {
      response.writeHead(200, { 'content-type': 'text/css; charset=utf-8' });
      response.end('#visible-text { font-weight: 700; }');
      return;
    }

    if (pathname === '/redirect/http') {
      response.writeHead(302, { location: '/browser-fixtures.html' });
      response.end();
      return;
    }

    if (pathname === '/redirect/meta-refresh') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end('<!doctype html><meta http-equiv="refresh" content="0; url=/browser-fixtures.html">');
      return;
    }

    if (pathname === '/redirect/javascript') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end('<!doctype html><script>window.location.assign("/browser-fixtures.html")</script>');
      return;
    }

    if (pathname === '/errors/upstream') {
      response.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Fixture upstream failure.');
      return;
    }

    const fixtureFile = FIXTURE_FILES.get(pathname);
    if (fixtureFile === undefined) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Fixture not found.');
      return;
    }

    const document = await readFile(new URL(`./${fixtureFile}`, import.meta.url), 'utf8');
    const contentType = fixtureFile.endsWith('.svg')
      ? 'image/svg+xml'
      : 'text/html; charset=utf-8';
    response.writeHead(200, { 'content-type': contentType });
    response.end(document);
  });

  await listen(server);
  const address = server.address();

  if (address === null || typeof address === 'string') {
    await close(server);
    throw new Error('The browser fixture server did not bind to a TCP port.');
  }

  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => close(server),
  };
}

function listen(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => error === undefined ? resolve() : reject(error));
  });
}
