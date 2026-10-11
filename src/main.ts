import { pathToFileURL } from 'node:url';

import { createApplication } from './bootstrap/application-bootstrap.js';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 3000;

export interface ServerConfiguration {
  host: string;
  port: number;
}

interface HttpApplication {
  listen(options: ServerConfiguration): Promise<unknown>;
  close(): Promise<unknown>;
}

export interface StartServerDependencies {
  createApplication?: () => Promise<HttpApplication>;
  environment?: NodeJS.ProcessEnv;
  logError?: (message: string) => void;
  exit?: (code: number) => void;
  on?: (signal: NodeJS.Signals, listener: () => void) => void;
}

class StartupConfigurationError extends Error {}

export function readServerConfiguration(
  environment: NodeJS.ProcessEnv = process.env,
): ServerConfiguration {
  const host = environment.HOST ?? DEFAULT_HOST;
  const portValue = environment.PORT;

  if (host.length === 0 || host.trim() !== host) {
    throw new StartupConfigurationError('Invalid HOST configuration.');
  }

  if (portValue !== undefined && !/^[0-9]+$/.test(portValue)) {
    throw new StartupConfigurationError('Invalid PORT configuration.');
  }

  const port = portValue === undefined ? DEFAULT_PORT : Number(portValue);
  if (port < 1 || port > 65535) {
    throw new StartupConfigurationError('Invalid PORT configuration.');
  }

  return { host, port };
}

export async function startServer(
  dependencies: StartServerDependencies = {},
): Promise<void> {
  const create = dependencies.createApplication ?? createApplication;
  const environment = dependencies.environment ?? process.env;
  const logError = dependencies.logError ?? console.error;
  const exit = dependencies.exit ?? ((code: number) => process.exit(code));
  const on = dependencies.on ?? process.on.bind(process);

  try {
    const configuration = readServerConfiguration(environment);
    const application = await create();
    await application.listen(configuration);
    registerShutdownHandlers(application, on, logError, exit);
  } catch (error) {
    const message = error instanceof StartupConfigurationError
      ? error.message
      : 'Failed to start HTTP server.';

    logError(message);
    exit(1);
  }
}

function registerShutdownHandlers(
  application: HttpApplication,
  on: (signal: NodeJS.Signals, listener: () => void) => void,
  logError: (message: string) => void,
  exit: (code: number) => void,
): void {
  let isShuttingDown = false;
  const shutdown = (): void => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    void application.close()
      .then(() => exit(0))
      .catch(() => {
        logError('Failed to close HTTP server.');
        exit(1);
      });
  };

  on('SIGINT', shutdown);
  on('SIGTERM', shutdown);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void startServer();
}
