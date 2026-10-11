import { describe, expect, test, vi } from 'vitest';

import { PlaywrightExtractor } from '../../../src/browser/playwright-extractor.js';
import type { ExtractionRequest } from '../../../src/contracts/extraction/extraction-port.js';
import type { Browser, BrowserContext, Frame, Page, Response } from 'playwright';

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

function createPage(
  response: Response,
  mainFrame = {},
  additionalMainNavigations = 0,
) {
  let responseListener: ((response: Response) => void) | undefined;
  let frameNavigationListener: ((frame: Frame) => void) | undefined;
  const page = {
    mainFrame: vi.fn().mockReturnValue(mainFrame),
    on: vi.fn((event: string, listener: (eventResponse: Response | Frame) => void) => {
      if (event === 'response') {
        responseListener = listener as (response: Response) => void;
      } else if (event === 'framenavigated') {
        frameNavigationListener = listener as (frame: Frame) => void;
      }
    }),
    off: vi.fn(),
    goto: vi.fn().mockImplementation(async () => {
      responseListener?.(response);
      frameNavigationListener?.(mainFrame as Frame);
      for (let index = 0; index < additionalMainNavigations; index += 1) {
        frameNavigationListener?.(mainFrame as Frame);
      }
    }),
  } as unknown as Page;

  return {
    page,
    emitMainFrameNavigation: () => frameNavigationListener?.(mainFrame as Frame),
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

  test('rejects an HTTP redirect for the main document navigation', async () => {
    const { browser } = createBrowser();
    const requestFrame = {};
    const response = {
      status: vi.fn().mockReturnValue(302),
      request: vi.fn().mockReturnValue({
        isNavigationRequest: vi.fn().mockReturnValue(true),
        frame: vi.fn().mockReturnValue(requestFrame),
      }),
    } as unknown as Response;
    const { page } = createPage(response, requestFrame);
    const extractor = new PlaywrightExtractor(browser);

    await expect(extractor.navigateMainDocument(page, request.url)).rejects.toMatchObject({
      code: 'REDIRECT_NOT_ALLOWED',
    });

    expect(page.goto).toHaveBeenCalledWith(request.url);
    expect(page.off).toHaveBeenCalledWith('response', expect.any(Function));
  });

  test('does not classify a redirect response from a secondary request as a main navigation redirect', async () => {
    const { browser } = createBrowser();
    const response = {
      status: vi.fn().mockReturnValue(301),
      request: vi.fn().mockReturnValue({
        isNavigationRequest: vi.fn().mockReturnValue(false),
        frame: vi.fn(),
      }),
    } as unknown as Response;
    const { page } = createPage(response);
    const extractor = new PlaywrightExtractor(browser);

    await expect(extractor.navigateMainDocument(page, request.url)).resolves.toBeUndefined();
  });

  test('rejects a subsequent main document navigation caused by meta refresh', async () => {
    const { browser } = createBrowser();
    const response = {
      status: vi.fn().mockReturnValue(200),
      request: vi.fn().mockReturnValue({
        isNavigationRequest: vi.fn().mockReturnValue(true),
        frame: vi.fn(),
      }),
    } as unknown as Response;
    const { page } = createPage(response, {}, 1);
    const extractor = new PlaywrightExtractor(browser);

    await expect(extractor.navigateMainDocument(page, request.url)).rejects.toMatchObject({
      code: 'REDIRECT_NOT_ALLOWED',
    });

    expect(page.on).toHaveBeenCalledWith('framenavigated', expect.any(Function));
    expect(page.off).toHaveBeenCalledWith('framenavigated', expect.any(Function));
  });

  test('rejects a subsequent main document navigation caused by JavaScript', async () => {
    const { browser } = createBrowser();
    const response = {
      status: vi.fn().mockReturnValue(200),
      request: vi.fn().mockReturnValue({
        isNavigationRequest: vi.fn().mockReturnValue(true),
        frame: vi.fn(),
      }),
    } as unknown as Response;
    const { page } = createPage(response, {}, 1);
    const extractor = new PlaywrightExtractor(browser);

    await expect(extractor.navigateMainDocument(page, request.url)).rejects.toMatchObject({
      code: 'REDIRECT_NOT_ALLOWED',
    });
  });
});
