import Fastify, { type FastifyInstance } from 'fastify';
import { chromium, type Browser } from 'playwright';

import { CreateFigmaDocumentUseCase } from '../application/create-figma-document/create-figma-document.js';
import { ExtractDocumentUseCase } from '../application/extract-document/extract-document.js';
import { PlaywrightExtractor } from '../browser/playwright-extractor.js';
import { registerApplicationErrorHandler } from '../http/error-handler/application-error-handler.js';
import { registerCors } from '../http/cors/cors.js';
import { registerExtractRoute } from '../http/routes/extract-route.js';
import { registerFigmaRoute } from '../http/routes/figma-route.js';
import type { ExtractionPort } from '../contracts/extraction/extraction-port.js';
import type { RuntimeEnvironment } from '../security/url-policy/public-url-policy.js';

export interface ApplicationBootstrapOptions {
  environment?: RuntimeEnvironment;
  launchBrowser?: () => Promise<Browser>;
  extractor?: ExtractionPort;
}

export async function createApplication(
  options: ApplicationBootstrapOptions = {},
): Promise<FastifyInstance> {
  const environment = options.environment ?? getRuntimeEnvironment();
  let browser: Browser | undefined;
  let extractor: ExtractionPort;

  if (options.extractor !== undefined) {
    extractor = options.extractor;
  } else {
    browser = await (options.launchBrowser ?? (() => chromium.launch()))();
    extractor = new PlaywrightExtractor(browser, environment);
  }
  const extractDocument = new ExtractDocumentUseCase(extractor, environment);
  const createFigmaDocument = new CreateFigmaDocumentUseCase(extractor);
  const application = Fastify();

  registerCors(application);
  registerApplicationErrorHandler(application);
  registerExtractRoute(application, extractDocument);
  registerFigmaRoute(application, createFigmaDocument);
  application.addHook('onClose', async () => {
    await browser?.close();
  });

  return application;
}

function getRuntimeEnvironment(): RuntimeEnvironment {
  return process.env.NODE_ENV === 'development' ? 'development' : 'production';
}
