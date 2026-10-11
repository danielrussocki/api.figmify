import Fastify from 'fastify';
import { afterEach, describe, expect, test } from 'vitest';

import { registerApplicationErrorHandler } from '../../../../src/http/error-handler/application-error-handler.js';

const applications = new Set<ReturnType<typeof Fastify>>();

afterEach(async () => {
  await Promise.all([...applications].map(async (application) => application.close()));
  applications.clear();
});

describe('registerApplicationErrorHandler', () => {
  test.each([
    ['INVALID_REQUEST', 400, 'The request query is invalid.'],
    ['URL_NOT_PUBLIC', 422, 'The URL must resolve to a public address.'],
    ['REDIRECT_NOT_ALLOWED', 502, 'The main document navigation must not redirect.'],
    ['UPSTREAM_FAILURE', 502, 'The upstream site could not be processed.'],
    ['INTERNAL_ERROR', 500, 'An internal error occurred.'],
  ] as const)('returns %s with status %i', async (code, statusCode, message) => {
    const application = Fastify();
    applications.add(application);
    registerApplicationErrorHandler(application);
    application.get('/', () => {
      throw { code, message };
    });

    const response = await application.inject({ method: 'GET', url: '/' });

    expect(response.statusCode).toBe(statusCode);
    expect(response.json()).toEqual({ code, message });
  });

  test('does not expose unknown error details', async () => {
    const application = Fastify();
    applications.add(application);
    registerApplicationErrorHandler(application);
    application.get('/', () => {
      throw new Error('C:\\private\\application-secret');
    });

    const response = await application.inject({ method: 'GET', url: '/' });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'An internal error occurred.',
    });
  });
});
