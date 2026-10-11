import type { Browser } from 'playwright';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { createApplication } from '../../../src/bootstrap/application-bootstrap.js';

describe('application bootstrap', () => {
  const applications: Array<Awaited<ReturnType<typeof createApplication>>> = [];

  afterEach(async () => {
    await Promise.all(applications.map((application) => application.close()));
    applications.length = 0;
  });

  test('creates Fastify with the browser-backed use cases, error handler, and both routes', async () => {
    const browser = {} as Browser;
    const launchBrowser = vi.fn(async () => browser);
    const application = await createApplication({
      environment: 'development',
      launchBrowser,
    });
    applications.push(application);

    const [extractResponse, figmaResponse] = await Promise.all([
      application.inject('/v1/extract'),
      application.inject('/v1/figma'),
    ]);

    expect(launchBrowser).toHaveBeenCalledOnce();
    expect(extractResponse.statusCode).toBe(400);
    expect(extractResponse.json()).toEqual({
      code: 'INVALID_REQUEST',
      message: 'The url query parameter must be an absolute HTTP or HTTPS URL.',
    });
    expect(figmaResponse.statusCode).toBe(400);
    expect(figmaResponse.json()).toEqual({
      code: 'INVALID_REQUEST',
      message: 'The url query parameter must be an absolute HTTP or HTTPS URL.',
    });
  });
});
