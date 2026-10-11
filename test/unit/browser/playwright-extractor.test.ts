import { describe, expect, test, vi } from 'vitest';

import { PlaywrightExtractor } from '../../../src/browser/playwright-extractor.js';
import type { ExtractionNode } from '../../../src/contracts/extraction/extraction-document.js';
import type { ExtractionRequest } from '../../../src/contracts/extraction/extraction-port.js';
import type { Browser, BrowserContext, Frame, Page, Request, Response, Route } from 'playwright';

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
  navigationResponse: Response = response,
) {
  let responseListener: ((response: Response) => void) | undefined;
  let frameNavigationListener: ((frame: Frame) => void) | undefined;
  let routeHandler: ((route: Route) => Promise<void>) | undefined;
  const waitForLoadState = vi.fn().mockResolvedValue(undefined);
  const waitForTimeout = vi.fn().mockResolvedValue(undefined);
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
    route: vi.fn((_: string, handler: (route: Route) => Promise<void>) => {
      routeHandler = handler;
    }),
    unroute: vi.fn(),
    waitForLoadState,
    waitForTimeout,
    goto: vi.fn().mockImplementation(async () => {
      responseListener?.(response);
      frameNavigationListener?.(mainFrame as Frame);
      for (let index = 0; index < additionalMainNavigations; index += 1) {
        frameNavigationListener?.(mainFrame as Frame);
      }
      return navigationResponse;
    }),
  } as unknown as Page;

  return {
    page,
    waitForLoadState,
    waitForTimeout,
    emitMainFrameNavigation: () => frameNavigationListener?.(mainFrame as Frame),
    applyRoute: (route: Route) => routeHandler?.(route),
  };
}

describe('PlaywrightExtractor', () => {
  test('extracts a complete v1 document after navigation and serializes the document root', async () => {
    const document: ExtractionNode = {
      id: 'node-1',
      tagName: 'html',
      attributes: {},
      resources: [],
      text: 'Welcome',
      styles: { display: 'block' },
      pseudoElements: { before: null, after: null },
      children: [],
    };
    const successfulResponse = {
      status: vi.fn().mockReturnValue(200),
      request: vi.fn().mockReturnValue({
        isNavigationRequest: vi.fn().mockReturnValue(false),
        frame: vi.fn(),
      }),
    } as unknown as Response;
    const closePage = vi.fn().mockResolvedValue(undefined);
    const page = {
      ...createPage(successfulResponse).page,
      evaluate: vi.fn().mockResolvedValue(document),
      close: closePage,
    } as unknown as Page;
    const closeContext = vi.fn().mockResolvedValue(undefined);
    const context = {
      newPage: vi.fn().mockResolvedValue(page),
      close: closeContext,
    } as unknown as BrowserContext;
    const browser = {
      newContext: vi.fn().mockResolvedValue(context),
    } as unknown as Browser;
    const extractor = new PlaywrightExtractor(browser);

    await expect(extractor.extract(request)).resolves.toEqual({
      schemaVersion: '1.0',
      source: {
        url: request.url,
        viewport: request.viewport,
        environment: {
          locale: 'en-US',
          timezone: 'UTC',
          colorScheme: 'light',
          reducedMotion: 'no-preference',
        },
      },
      document,
    });

    expect(context.newPage).toHaveBeenCalledTimes(1);
    expect(page.evaluate).toHaveBeenCalledTimes(1);
    expect(closePage).toHaveBeenCalledTimes(1);
    expect(closeContext).toHaveBeenCalledTimes(1);
  });

  test('classifies serialization failures as upstream failures and closes browser resources', async () => {
    const successfulResponse = {
      status: vi.fn().mockReturnValue(200),
      request: vi.fn().mockReturnValue({
        isNavigationRequest: vi.fn().mockReturnValue(false),
        frame: vi.fn(),
      }),
    } as unknown as Response;
    const closePage = vi.fn().mockResolvedValue(undefined);
    const page = {
      ...createPage(successfulResponse).page,
      evaluate: vi.fn().mockRejectedValue(new Error('Execution context was destroyed')),
      close: closePage,
    } as unknown as Page;
    const closeContext = vi.fn().mockResolvedValue(undefined);
    const context = {
      newPage: vi.fn().mockResolvedValue(page),
      close: closeContext,
    } as unknown as BrowserContext;
    const browser = {
      newContext: vi.fn().mockResolvedValue(context),
    } as unknown as Browser;
    const extractor = new PlaywrightExtractor(browser);

    await expect(extractor.extract(request)).rejects.toMatchObject({
      code: 'UPSTREAM_FAILURE',
      message: 'The upstream site could not be processed.',
    });

    expect(closePage).toHaveBeenCalledTimes(1);
    expect(closeContext).toHaveBeenCalledTimes(1);
  });

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
    const mainDocumentResponse = { status: vi.fn().mockReturnValue(200) } as unknown as Response;
    const { page } = createPage(response, {}, 0, mainDocumentResponse);
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

  test('blocks a non-public main navigation destination in production before it loads', async () => {
    const { browser } = createBrowser();
    const response = {
      status: vi.fn().mockReturnValue(200),
      request: vi.fn().mockReturnValue({
        isNavigationRequest: vi.fn().mockReturnValue(true),
        frame: vi.fn(),
      }),
    } as unknown as Response;
    const { page, applyRoute, waitForLoadState, waitForTimeout } = createPage(response);
    const abort = vi.fn().mockResolvedValue(undefined);
    const continueRequest = vi.fn().mockResolvedValue(undefined);
    const blockedRequest = {
      isNavigationRequest: vi.fn().mockReturnValue(true),
      frame: vi.fn().mockReturnValue(page.mainFrame()),
      url: vi.fn().mockReturnValue('http://127.0.0.1/private'),
    } as unknown as Request;
    const route = {
      request: vi.fn().mockReturnValue(blockedRequest),
      abort,
      continue: continueRequest,
    } as unknown as Route;
    vi.mocked(page.goto).mockImplementation(async () => {
      await applyRoute(route);
      throw new Error('net::ERR_FAILED');
    });
    const extractor = new PlaywrightExtractor(browser, 'production');

    await expect(extractor.navigateMainDocument(page, request.url)).rejects.toMatchObject({
      code: 'URL_NOT_PUBLIC',
      message: 'The URL must resolve to a public address.',
    });

    expect(abort).toHaveBeenCalledTimes(1);
    expect(continueRequest).not.toHaveBeenCalled();
    expect(waitForLoadState).not.toHaveBeenCalled();
    expect(waitForTimeout).not.toHaveBeenCalled();
  });

  test('waits for load and an additional 30 seconds before completing navigation', async () => {
    const { browser } = createBrowser();
    const response = {
      status: vi.fn().mockReturnValue(200),
      request: vi.fn().mockReturnValue({
        isNavigationRequest: vi.fn().mockReturnValue(true),
        frame: vi.fn(),
      }),
    } as unknown as Response;
    const { page, waitForLoadState, waitForTimeout } = createPage(response);
    let resolveLoad: (() => void) | undefined;
    waitForLoadState.mockImplementation(
      () => new Promise<void>((resolve) => {
        resolveLoad = resolve;
      }),
    );
    const extractor = new PlaywrightExtractor(browser);

    const navigation = extractor.navigateMainDocument(page, request.url);
    await vi.waitFor(() => expect(waitForLoadState).toHaveBeenCalledWith('load'));

    expect(waitForTimeout).not.toHaveBeenCalled();

    resolveLoad?.();
    await vi.waitFor(() => expect(waitForTimeout).toHaveBeenCalledWith(30_000));
    await expect(navigation).resolves.toBeUndefined();
  });

  test.each([
    ['network', 'net::ERR_NAME_NOT_RESOLVED'],
    ['certificate', 'net::ERR_CERT_AUTHORITY_INVALID'],
  ])('classifies a %s navigation failure as an upstream failure without internal details', async (_, detail) => {
    const { browser } = createBrowser();
    const response = {
      status: vi.fn().mockReturnValue(200),
      request: vi.fn().mockReturnValue({
        isNavigationRequest: vi.fn().mockReturnValue(true),
        frame: vi.fn(),
      }),
    } as unknown as Response;
    const { page } = createPage(response);
    vi.mocked(page.goto).mockRejectedValue(new Error(detail));
    const extractor = new PlaywrightExtractor(browser);

    await expect(extractor.navigateMainDocument(page, request.url)).rejects.toMatchObject({
      code: 'UPSTREAM_FAILURE',
      message: 'The upstream site could not be processed.',
    });
    await expect(extractor.navigateMainDocument(page, request.url)).rejects.not.toThrow(detail);
  });

  test('classifies an unsuccessful main document response as an upstream failure', async () => {
    const { browser } = createBrowser();
    const response = {
      status: vi.fn().mockReturnValue(503),
      request: vi.fn().mockReturnValue({
        isNavigationRequest: vi.fn().mockReturnValue(true),
        frame: vi.fn(),
      }),
    } as unknown as Response;
    const { page, waitForLoadState, waitForTimeout } = createPage(response);
    const extractor = new PlaywrightExtractor(browser);

    await expect(extractor.navigateMainDocument(page, request.url)).rejects.toMatchObject({
      code: 'UPSTREAM_FAILURE',
      message: 'The upstream site could not be processed.',
    });

    expect(waitForLoadState).not.toHaveBeenCalled();
    expect(waitForTimeout).not.toHaveBeenCalled();
  });

  test('classifies document processing failures as an upstream failure without internal details', async () => {
    const { browser } = createBrowser();
    const response = {
      status: vi.fn().mockReturnValue(200),
      request: vi.fn().mockReturnValue({
        isNavigationRequest: vi.fn().mockReturnValue(true),
        frame: vi.fn(),
      }),
    } as unknown as Response;
    const { page, waitForLoadState } = createPage(response);
    vi.mocked(waitForLoadState).mockRejectedValue(new Error('Execution context was destroyed at C:\\private\\path'));
    const extractor = new PlaywrightExtractor(browser);

    await expect(extractor.navigateMainDocument(page, request.url)).rejects.toMatchObject({
      code: 'UPSTREAM_FAILURE',
      message: 'The upstream site could not be processed.',
    });
    await expect(extractor.navigateMainDocument(page, request.url)).rejects.not.toThrow('C:\\private\\path');
  });
});
