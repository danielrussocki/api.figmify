import { describe, expect, test, vi } from 'vitest';

import { PlaywrightExtractor } from '../../../src/browser/playwright-extractor.js';
import type { ExtractionRequest } from '../../../src/contracts/extraction/extraction-port.js';
import type { Browser, BrowserContext } from 'playwright';

const request: ExtractionRequest = {
  url: 'https://example.com/page',
  viewport: { width: 1280, height: 720, deviceScaleFactor: 2 },
};

function createBrowser() {
  const context = {} as BrowserContext;
  const newContext = vi.fn().mockResolvedValue(context);

  return {
    browser: { newContext } as unknown as Browser,
    context,
    newContext,
  };
}

describe('PlaywrightExtractor', () => {
  test('creates a context with the request viewport and fixed rendering environment', async () => {
    const { browser, context, newContext } = createBrowser();
    const extractor = new PlaywrightExtractor(browser);

    await expect(extractor.createContext(request)).resolves.toBe(context);

    expect(newContext).toHaveBeenCalledTimes(1);
    expect(newContext).toHaveBeenCalledWith({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 2,
      locale: 'en-US',
      timezoneId: 'UTC',
      colorScheme: 'light',
      reducedMotion: 'no-preference',
      contrast: 'no-preference',
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    });
  });

  test('creates an isolated browser context for every extraction request', async () => {
    const { browser, newContext } = createBrowser();
    const extractor = new PlaywrightExtractor(browser);

    await extractor.createContext(request);
    await extractor.createContext({
      ...request,
      viewport: { width: 1920, height: 1080, deviceScaleFactor: 3 },
    });

    expect(newContext).toHaveBeenCalledTimes(2);
    expect(newContext).toHaveBeenNthCalledWith(2, {
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 3,
      locale: 'en-US',
      timezoneId: 'UTC',
      colorScheme: 'light',
      reducedMotion: 'no-preference',
      contrast: 'no-preference',
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    });
  });
});
