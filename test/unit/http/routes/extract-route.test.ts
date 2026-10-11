import Fastify from 'fastify';
import { afterEach, describe, expect, test, vi } from 'vitest';

import type { ExtractionDocument } from '../../../../src/contracts/extraction/extraction-document.js';
import { registerApplicationErrorHandler } from '../../../../src/http/error-handler/application-error-handler.js';
import { registerExtractRoute } from '../../../../src/http/routes/extract-route.js';

const applications = new Set<ReturnType<typeof Fastify>>();

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
    tagName: 'html',
    attributes: {},
    resources: [],
    text: null,
    styles: {},
    pseudoElements: { before: null, after: null },
    children: [],
  },
};

afterEach(async () => {
  await Promise.all([...applications].map(async (application) => application.close()));
  applications.clear();
});

function createApplication(execute = vi.fn().mockResolvedValue(extractionDocument)) {
  const application = Fastify();
  applications.add(application);
  registerApplicationErrorHandler(application);
  registerExtractRoute(application, { execute });
  return { application, execute };
}

describe('GET /v1/extract', () => {
  test('normalizes the query, executes the extraction use case, and returns its document', async () => {
    const { application, execute } = createApplication();

    const response = await application.inject({
      method: 'GET',
      url: '/v1/extract?url=https%3A%2F%2Fexample.com%2Fpage%23heading&width=1280&height=720&deviceScaleFactor=2',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(extractionDocument);
    expect(execute).toHaveBeenCalledWith({
      url: 'https://example.com/page#heading',
      viewport: { width: 1280, height: 720, deviceScaleFactor: 2 },
    });
  });

  test('uses the default viewport values when they are omitted', async () => {
    const { application, execute } = createApplication();

    const response = await application.inject({
      method: 'GET',
      url: '/v1/extract?url=https%3A%2F%2Fexample.com%2F',
    });

    expect(response.statusCode).toBe(200);
    expect(execute).toHaveBeenCalledWith({
      url: 'https://example.com/',
      viewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
    });
  });

  test('returns the normalized invalid request error without executing the use case', async () => {
    const { application, execute } = createApplication();

    const response = await application.inject({ method: 'GET', url: '/v1/extract?url=ftp%3A%2F%2Fexample.com' });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      code: 'INVALID_REQUEST',
      message: 'The url query parameter must be an absolute HTTP or HTTPS URL.',
    });
    expect(execute).not.toHaveBeenCalled();
  });

  test('delegates application errors to the global error handler', async () => {
    const { application } = createApplication(
      vi.fn().mockRejectedValue({
        code: 'UPSTREAM_FAILURE',
        message: 'The upstream site could not be processed.',
      }),
    );

    const response = await application.inject({
      method: 'GET',
      url: '/v1/extract?url=https%3A%2F%2Fexample.com%2F',
    });

    expect(response.statusCode).toBe(502);
    expect(response.json()).toEqual({
      code: 'UPSTREAM_FAILURE',
      message: 'The upstream site could not be processed.',
    });
  });
});
