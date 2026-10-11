import type { Browser, BrowserContext, Frame, Page, Response } from 'playwright';

import {
  MainDocumentRedirectError,
  UpstreamFailureError,
} from '../contracts/errors/application-error.js';
import type { ExtractionRequest } from '../contracts/extraction/extraction-port.js';
import { FIXED_RENDERING_ENVIRONMENT } from '../contracts/extraction/defaults.js';

const POST_LOAD_SERIALIZATION_DELAY_MS = 30_000;

/**
 * Creates isolated Playwright contexts configured for reproducible extraction.
 * Navigation and document serialization are added by subsequent extraction tasks.
 */
export class PlaywrightExtractor {
  constructor(private readonly browser: Browser) {}

  createContext(request: ExtractionRequest): Promise<BrowserContext> {
    return this.browser.newContext({
      viewport: {
        width: request.viewport.width,
        height: request.viewport.height,
      },
      deviceScaleFactor: request.viewport.deviceScaleFactor,
      locale: FIXED_RENDERING_ENVIRONMENT.locale,
      timezoneId: FIXED_RENDERING_ENVIRONMENT.timezone,
      colorScheme: FIXED_RENDERING_ENVIRONMENT.colorScheme,
      reducedMotion: FIXED_RENDERING_ENVIRONMENT.reducedMotion,
      contrast: FIXED_RENDERING_ENVIRONMENT.contrast,
      userAgent: FIXED_RENDERING_ENVIRONMENT.userAgent,
    });
  }

  async navigateMainDocument(page: Page, url: string): Promise<void> {
    let redirected = false;
    let initialMainDocumentNavigationCommitted = false;
    const detectMainDocumentRedirect = (response: Response): void => {
      const navigationRequest = response.request();
      const isMainDocumentNavigation =
        navigationRequest.isNavigationRequest() && navigationRequest.frame() === page.mainFrame();

      if (isMainDocumentNavigation && response.status() >= 300 && response.status() < 400) {
        redirected = true;
      }
    };
    const detectSubsequentMainDocumentNavigation = (frame: Frame): void => {
      if (frame !== page.mainFrame()) {
        return;
      }

      if (initialMainDocumentNavigationCommitted) {
        redirected = true;
        return;
      }

      initialMainDocumentNavigationCommitted = true;
    };

    page.on('response', detectMainDocumentRedirect);
    page.on('framenavigated', detectSubsequentMainDocumentNavigation);
    try {
      const response = await page.goto(url);
      if (redirected) {
        throw new MainDocumentRedirectError();
      }

      if (response !== null && response.status() >= 300 && response.status() < 400) {
        throw new MainDocumentRedirectError();
      }

      if (response === null || response.status() < 200 || response.status() >= 300) {
        throw new UpstreamFailureError();
      }

      await page.waitForLoadState('load');
      await page.waitForTimeout(POST_LOAD_SERIALIZATION_DELAY_MS);

      if (redirected) {
        throw new MainDocumentRedirectError();
      }
    } catch (error) {
      if (error instanceof MainDocumentRedirectError) {
        throw error;
      }

      throw new UpstreamFailureError();
    } finally {
      page.off('response', detectMainDocumentRedirect);
      page.off('framenavigated', detectSubsequentMainDocumentNavigation);
    }
  }
}
