import Fastify, { type FastifyInstance } from 'fastify';
import { chromium, type Browser } from 'playwright';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';

import { CreateFigmaDocumentUseCase } from '../../src/application/create-figma-document/create-figma-document.js';
import { ExtractDocumentUseCase } from '../../src/application/extract-document/extract-document.js';
import { PlaywrightExtractor } from '../../src/browser/playwright-extractor.js';
import type { ExtractionDocument } from '../../src/contracts/extraction/extraction-document.js';
import type { FigmaDocument } from '../../src/contracts/figma/figma-document.js';
import { registerApplicationErrorHandler } from '../../src/http/error-handler/application-error-handler.js';
import { registerExtractRoute } from '../../src/http/routes/extract-route.js';
import { registerFigmaRoute } from '../../src/http/routes/figma-route.js';
import { startBrowserFixtureServer, type BrowserFixtureServer } from '../fixtures/browser/server.js';

let application: FastifyInstance;
let applicationUrl: string;
let browser: Browser;
let fixtureServer: BrowserFixtureServer;

beforeAll(async () => {
  browser = await chromium.launch();
  fixtureServer = await startBrowserFixtureServer();
  shortenPostLoadWait(browser);

  const extractor = new PlaywrightExtractor(browser, 'development');
  const extractDocument = new ExtractDocumentUseCase(extractor, 'development');
  const createFigmaDocument = new CreateFigmaDocumentUseCase(extractor);

  application = Fastify();
  registerApplicationErrorHandler(application);
  registerExtractRoute(application, extractDocument);
  registerFigmaRoute(application, createFigmaDocument);
  applicationUrl = await application.listen({ host: '127.0.0.1', port: 0 });
});

afterAll(async () => {
  await application.close();
  await fixtureServer.close();
  await browser.close();
  vi.restoreAllMocks();
});

describe('successful HTTP responses', () => {
  test('GET /v1/extract returns an ExtractionDocument v1 with the default viewport', async () => {
    const document = await requestJson<ExtractionDocument>('/v1/extract');

    expect(document).toMatchObject({
      schemaVersion: '1.0',
      source: {
        url: `${fixtureServer.url}/browser-fixtures.html`,
        viewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
        environment: {
          locale: 'en-US',
          timezone: 'UTC',
          colorScheme: 'light',
          reducedMotion: 'no-preference',
        },
      },
      document: { id: expect.any(String), tagName: 'html' },
    });
  });

  test('GET /v1/extract returns an ExtractionDocument v1 with the configured viewport', async () => {
    const document = await requestJson<ExtractionDocument>('/v1/extract', {
      width: '1280',
      height: '720',
      deviceScaleFactor: '2',
    });

    expect(document).toMatchObject({
      schemaVersion: '1.0',
      source: {
        viewport: { width: 1280, height: 720, deviceScaleFactor: 2 },
      },
      document: { id: expect.any(String), tagName: 'html' },
    });
  });

  test('GET /v1/figma returns a FigmaDocument v1 with the default viewport', async () => {
    const document = await requestJson<FigmaDocument>('/v1/figma');

    expect(document).toMatchObject({
      schemaVersion: '1.0',
      source: {
        url: `${fixtureServer.url}/browser-fixtures.html`,
        viewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
      },
      styles: { colors: expect.any(Array), typographies: expect.any(Array) },
      document: { sourceId: expect.any(String), type: 'DOCUMENT', name: 'html' },
    });
  });

  test('GET /v1/figma returns a FigmaDocument v1 with the configured viewport', async () => {
    const document = await requestJson<FigmaDocument>('/v1/figma', {
      width: '1440',
      height: '900',
      deviceScaleFactor: '3',
    });

    expect(document).toMatchObject({
      schemaVersion: '1.0',
      source: {
        viewport: { width: 1440, height: 900, deviceScaleFactor: 3 },
      },
      styles: { colors: expect.any(Array), typographies: expect.any(Array) },
      document: { sourceId: expect.any(String), type: 'DOCUMENT', name: 'html' },
    });
  });
});

async function requestJson<T>(
  path: string,
  viewport: Record<string, string> = {},
): Promise<T> {
  const query = new URLSearchParams({
    url: `${fixtureServer.url}/browser-fixtures.html`,
    ...viewport,
  });
  const response = await fetch(`${applicationUrl}${path}?${query}`);

  expect(response.status).toBe(200);
  return response.json() as Promise<T>;
}

function shortenPostLoadWait(browserInstance: Browser): void {
  const newContext = browserInstance.newContext.bind(browserInstance);
  vi.spyOn(browserInstance, 'newContext').mockImplementation(async (...arguments_) => {
    const context = await newContext(...arguments_);
    context.on('page', (page) => {
      vi.spyOn(page, 'waitForTimeout').mockResolvedValue(undefined);
    });
    return context;
  });
}
