import type { Browser } from 'playwright';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { createApplication } from '../../../src/bootstrap/application-bootstrap.js';
import type { ExtractionDocument } from '../../../src/contracts/extraction/extraction-document.js';

describe('application bootstrap', () => {
  const applications: Array<Awaited<ReturnType<typeof createApplication>>> = [];

  afterEach(async () => {
    await Promise.all(applications.map((application) => application.close()));
    applications.length = 0;
  });

  test('creates Fastify with the browser-backed use cases, error handler, and both routes', async () => {
    const browser = { close: vi.fn(async () => undefined) } as unknown as Browser;
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
    expect(extractResponse.headers['access-control-allow-origin']).toBe('*');
    expect(extractResponse.json()).toEqual({
      code: 'INVALID_REQUEST',
      message: 'The url query parameter must be an absolute HTTP or HTTPS URL.',
    });
    expect(figmaResponse.statusCode).toBe(400);
    expect(figmaResponse.headers['access-control-allow-origin']).toBe('*');
    expect(figmaResponse.json()).toEqual({
      code: 'INVALID_REQUEST',
      message: 'The url query parameter must be an absolute HTTP or HTTPS URL.',
    });

    await application.close();
    expect(browser.close).toHaveBeenCalledOnce();
    applications.pop();
  });

  test('exposes both routes with a controlled extraction dependency', async () => {
    const extractionDocument: ExtractionDocument = {
      schemaVersion: '1.0',
      source: {
        url: 'https://example.com/',
        viewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
        environment: {
          locale: 'en-US',
          timezone: 'UTC',
          colorScheme: 'light',
          reducedMotion: 'no-preference',
        },
      },
      document: {
        id: 'node-1',
        tagName: 'body',
        attributes: {},
        resources: [],
        text: 'Hello',
        styles: {},
        pseudoElements: { before: null, after: null },
        children: [],
      },
    };
    const extractor = { extract: vi.fn(async () => extractionDocument) };
    const application = await createApplication({
      environment: 'development',
      extractor,
    });
    applications.push(application);

    const [extractResponse, figmaResponse] = await Promise.all([
      application.inject('/v1/extract?url=https%3A%2F%2Fexample.com%2F'),
      application.inject('/v1/figma?url=https%3A%2F%2Fexample.com%2F'),
    ]);

    expect(extractResponse.statusCode).toBe(200);
    expect(extractResponse.headers['access-control-allow-origin']).toBe('*');
    expect(extractResponse.json()).toEqual(extractionDocument);
    expect(figmaResponse.statusCode).toBe(200);
    expect(figmaResponse.headers['access-control-allow-origin']).toBe('*');
    expect(figmaResponse.json()).toMatchObject({
      schemaVersion: '1.0',
      source: {
        url: 'https://example.com/',
        viewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
      },
      document: {
        id: 'node-1',
        tag: 'body',
        type: 'TEXT',
        rect: { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0 },
        isVisible: true,
      },
    });
    expect(extractor.extract).toHaveBeenCalledTimes(2);
  });
});
