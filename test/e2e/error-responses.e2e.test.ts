import Fastify, { type FastifyInstance } from 'fastify';
import { chromium, type Browser } from 'playwright';
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';

import { CreateFigmaDocumentUseCase } from '../../src/application/create-figma-document/create-figma-document.js';
import { ExtractDocumentUseCase } from '../../src/application/extract-document/extract-document.js';
import { PlaywrightExtractor } from '../../src/browser/playwright-extractor.js';
import type { ExtractionPort } from '../../src/contracts/extraction/extraction-port.js';
import { registerApplicationErrorHandler } from '../../src/http/error-handler/application-error-handler.js';
import { registerExtractRoute } from '../../src/http/routes/extract-route.js';
import { registerFigmaRoute } from '../../src/http/routes/figma-route.js';
import type { RuntimeEnvironment } from '../../src/security/url-policy/public-url-policy.js';
import { startBrowserFixtureServer, type BrowserFixtureServer } from '../fixtures/browser/server.js';

const routes = ['/v1/extract', '/v1/figma'] as const;

let browser: Browser;
let fixtureServer: BrowserFixtureServer;
const applications = new Set<FastifyInstance>();

beforeAll(async () => {
  browser = await chromium.launch();
  fixtureServer = await startBrowserFixtureServer();
});

afterEach(async () => {
  await Promise.all([...applications].map((application) => application.close()));
  applications.clear();
});

afterAll(async () => {
  await fixtureServer.close();
  await browser.close();
});

describe('error HTTP responses', () => {
  test.each(routes)('%s returns a normalized 400 without a partial document', async (route) => {
    const applicationUrl = await startApplication('development');

    await expectError(applicationUrl, route, 'not-a-url', 400, 'INVALID_REQUEST',
      'The url query parameter must be an absolute HTTP or HTTPS URL.');
  });

  test('GET /v1/figma rejects an invalid includeHidden value without a partial document', async () => {
    const applicationUrl = await startApplication('development');
    const response = await fetch(`${applicationUrl}/v1/figma?${new URLSearchParams({
      url: `${fixtureServer.url}/browser-fixtures.html`,
      includeHidden: 'yes',
    })}`);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      code: 'INVALID_REQUEST',
      message: 'The includeHidden query parameter must be true or false.',
    });
  });

  test.each(routes)('%s returns a normalized 422 for a non-public URL in production', async (route) => {
    const applicationUrl = await startApplication('production');

    await expectError(applicationUrl, route, `${fixtureServer.url}/browser-fixtures.html`, 422, 'URL_NOT_PUBLIC',
      'The URL must resolve to a public address.');
  });

  test.each([
    ['/v1/extract', '/redirect/http', 'REDIRECT_NOT_ALLOWED', 'The main document navigation must not redirect.'],
    ['/v1/figma', '/errors/upstream', 'UPSTREAM_FAILURE', 'The upstream site could not be processed.'],
  ] as const)('%s returns a normalized 502 without a partial document', async (route, path, code, message) => {
    const applicationUrl = await startApplication('development');

    await expectError(applicationUrl, route, `${fixtureServer.url}${path}`, 502, code, message);
  });

  test.each(routes)('%s returns a sanitized 500 without a partial document', async (route) => {
    const extractor: ExtractionPort = {
      extract: async () => {
        throw new Error('C:\\private\\application-secret');
      },
    };
    const applicationUrl = await startApplication('development', extractor);

    await expectError(applicationUrl, route, 'https://example.com/', 500, 'INTERNAL_ERROR',
      'An internal error occurred.');
  });
});

async function startApplication(
  environment: RuntimeEnvironment,
  extractor: ExtractionPort = new PlaywrightExtractor(browser, environment),
): Promise<string> {
  const application = Fastify();
  applications.add(application);
  registerApplicationErrorHandler(application);
  registerExtractRoute(application, new ExtractDocumentUseCase(extractor, environment));
  registerFigmaRoute(application, new CreateFigmaDocumentUseCase(extractor));

  return application.listen({ host: '127.0.0.1', port: 0 });
}

async function expectError(
  applicationUrl: string,
  route: string,
  url: string,
  status: number,
  code: string,
  message: string,
): Promise<void> {
  const response = await fetch(`${applicationUrl}${route}?${new URLSearchParams({ url })}`);

  expect(response.status).toBe(status);
  expect(await response.json()).toEqual({ code, message });
}
