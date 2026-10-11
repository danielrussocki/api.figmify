import { createServer } from 'node:net';
import { once } from 'node:events';

import { afterEach, describe, expect, test, vi } from 'vitest';

import { createApplication } from '../../src/bootstrap/application-bootstrap.js';
import { startServer } from '../../src/main.js';

async function reservePort(): Promise<number> {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');

  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Failed to reserve a TCP port.');
  }

  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error === undefined ? resolve() : reject(error)));
  });
  return address.port;
}

describe('local API execution', () => {
  const closeApplications: Array<() => Promise<unknown>> = [];

  afterEach(async () => {
    await Promise.all(closeApplications.splice(0).map((close) => close()));
  });

  test('accepts an HTTP request on the configured host and port', async () => {
    const port = await reservePort();
    const on = vi.fn();
    const exit = vi.fn();
    const application = await createApplication({
      environment: 'development',
      extractor: { extract: vi.fn() },
    });
    closeApplications.push(() => application.close());

    await startServer({
      createApplication: async () => application,
      environment: { HOST: '127.0.0.1', PORT: String(port) },
      on,
      exit,
    });

    const response = await fetch(`http://127.0.0.1:${port}/v1/extract`);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: 'INVALID_REQUEST',
      message: 'The url query parameter must be an absolute HTTP or HTTPS URL.',
    });

    const shutdown = on.mock.calls.find(([signal]) => signal === 'SIGTERM')?.[1] as
      | (() => void)
      | undefined;
    expect(shutdown).toBeDefined();
    shutdown?.();
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));
    closeApplications.length = 0;
  });
});
