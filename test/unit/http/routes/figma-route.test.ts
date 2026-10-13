import Fastify from 'fastify';
import { afterEach, describe, expect, test, vi } from 'vitest';

import type { FigmaDocument } from '../../../../src/contracts/figma/figma-document.js';
import { registerApplicationErrorHandler } from '../../../../src/http/error-handler/application-error-handler.js';
import { registerFigmaRoute } from '../../../../src/http/routes/figma-route.js';

const applications = new Set<ReturnType<typeof Fastify>>();

const figmaDocument: FigmaDocument = {
  schemaVersion: '1.0',
  source: {
    url: 'https://example.com/',
    viewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
  },
  styles: { colors: [], typographies: [] },
  document: {
    id: 'node-1',
    tag: 'html',
    type: 'FRAME',
    rect: { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0 },
    isVisible: true,
    children: [],
  },
};

afterEach(async () => {
  await Promise.all([...applications].map(async (application) => application.close()));
  applications.clear();
});

function createApplication(execute = vi.fn().mockResolvedValue(figmaDocument)) {
  const application = Fastify();
  applications.add(application);
  registerApplicationErrorHandler(application);
  registerFigmaRoute(application, { execute });
  return { application, execute };
}

describe('GET /v1/figma', () => {
  test('normalizes the query, executes the Figma use case, and returns its document', async () => {
    const { application, execute } = createApplication();

    const response = await application.inject({
      method: 'GET',
      url: '/v1/figma?url=https%3A%2F%2Fexample.com%2Fpage%23heading&width=1280&height=720&deviceScaleFactor=2',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(figmaDocument);
    expect(execute).toHaveBeenCalledWith({
      url: 'https://example.com/page#heading',
      viewport: { width: 1280, height: 720, deviceScaleFactor: 2 },
    });
  });

  test('uses the default viewport values when they are omitted', async () => {
    const { application, execute } = createApplication();

    const response = await application.inject({
      method: 'GET',
      url: '/v1/figma?url=https%3A%2F%2Fexample.com%2F',
    });

    expect(response.statusCode).toBe(200);
    expect(execute).toHaveBeenCalledWith({
      url: 'https://example.com/',
      viewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
    });
  });

  test('returns the normalized invalid request error without executing the use case', async () => {
    const { application, execute } = createApplication();

    const response = await application.inject({ method: 'GET', url: '/v1/figma?url=ftp%3A%2F%2Fexample.com' });

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
      url: '/v1/figma?url=https%3A%2F%2Fexample.com%2F',
    });

    expect(response.statusCode).toBe(502);
    expect(response.json()).toEqual({
      code: 'UPSTREAM_FAILURE',
      message: 'The upstream site could not be processed.',
    });
  });
});
