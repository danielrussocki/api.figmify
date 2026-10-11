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
    const close = vi.fn(async () => undefined);
    const createApplication = vi.fn(async () => ({ listen, close }));

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
      createApplication: async () => ({ listen, close: async () => undefined }),
      environment: {},
      logError,
      exit,
    });

    expect(logError).toHaveBeenCalledWith('Failed to start HTTP server.');
    expect(exit).toHaveBeenCalledWith(1);
  });

  test('closes the application and exits cleanly when a termination signal is received', async () => {
    const listen = vi.fn(async () => undefined);
    const close = vi.fn(async () => undefined);
    const on = vi.fn();
    const logError = vi.fn();
    const exit = vi.fn();

    await startServer({
      createApplication: async () => ({ listen, close }),
      environment: {},
      on,
      logError,
      exit,
    });

    expect(on).toHaveBeenCalledTimes(2);
    expect(on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    expect(on).toHaveBeenCalledWith('SIGTERM', expect.any(Function));

    const shutdown = on.mock.calls[0]?.[1] as (() => void) | undefined;
    expect(shutdown).toBeDefined();
    shutdown?.();
    await vi.waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(exit).toHaveBeenCalledWith(0);
    expect(logError).not.toHaveBeenCalled();
  });

  test('logs an English error and exits unsuccessfully when orderly shutdown fails', async () => {
    const listen = vi.fn(async () => undefined);
    const close = vi.fn(async () => {
      throw new Error('close failed');
    });
    const on = vi.fn();
    const logError = vi.fn();
    const exit = vi.fn();

    await startServer({
      createApplication: async () => ({ listen, close }),
      environment: {},
      on,
      logError,
      exit,
    });

    const shutdown = on.mock.calls[0]?.[1] as (() => void) | undefined;
    shutdown?.();
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(1));
    expect(logError).toHaveBeenCalledWith('Failed to close HTTP server.');
  });
});
