import { describe, expect, test, vi } from 'vitest';

import {
  readServerConfiguration,
  startServer,
} from '../../src/main.js';

describe('server entry point', () => {
  test('uses the documented default listener configuration', () => {
    expect(readServerConfiguration({})).toEqual({
      host: '127.0.0.1',
      port: 3000,
    });
  });

  test('accepts a valid configured host and port', () => {
    expect(readServerConfiguration({ HOST: '0.0.0.0', PORT: '8080' })).toEqual({
      host: '0.0.0.0',
      port: 8080,
    });
  });

  test.each([
    [{ HOST: '' }, 'Invalid HOST configuration.'],
    [{ HOST: ' localhost' }, 'Invalid HOST configuration.'],
    [{ PORT: '0' }, 'Invalid PORT configuration.'],
    [{ PORT: '3000.5' }, 'Invalid PORT configuration.'],
  ])('rejects invalid operational configuration: %o', (environment, message) => {
    expect(() => readServerConfiguration(environment)).toThrow(message);
  });

  test('creates the application and listens using the configured address', async () => {
    const listen = vi.fn(async () => undefined);
    const createApplication = vi.fn(async () => ({ listen }));

    await startServer({
      createApplication,
      environment: { HOST: 'api.example.test', PORT: '8080' },
    });

    expect(createApplication).toHaveBeenCalledOnce();
    expect(listen).toHaveBeenCalledWith({ host: 'api.example.test', port: 8080 });
  });

  test('logs an English error and exits without creating an application for invalid configuration', async () => {
    const createApplication = vi.fn();
    const logError = vi.fn();
    const exit = vi.fn();

    await startServer({
      createApplication,
      environment: { PORT: 'invalid' },
      logError,
      exit,
    });

    expect(createApplication).not.toHaveBeenCalled();
    expect(logError).toHaveBeenCalledWith('Invalid PORT configuration.');
    expect(exit).toHaveBeenCalledWith(1);
  });

  test('logs an English error and exits when binding fails', async () => {
    const listen = vi.fn(async () => {
      throw new Error('EADDRINUSE');
    });
    const logError = vi.fn();
    const exit = vi.fn();

    await startServer({
      createApplication: async () => ({ listen }),
      environment: {},
      logError,
      exit,
    });

    expect(logError).toHaveBeenCalledWith('Failed to start HTTP server.');
    expect(exit).toHaveBeenCalledWith(1);
  });
});
