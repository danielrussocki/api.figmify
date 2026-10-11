import type { Browser, BrowserContext, Frame, Page, Response } from 'playwright';

import { MainDocumentRedirectError } from '../contracts/errors/application-error.js';
import type { ExtractionRequest } from '../contracts/extraction/extraction-port.js';
import { FIXED_RENDERING_ENVIRONMENT } from '../contracts/extraction/defaults.js';

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
      await page.goto(url);
      if (redirected) {
        throw new MainDocumentRedirectError();
      }
    } finally {
      page.off('response', detectMainDocumentRedirect);
      page.off('framenavigated', detectSubsequentMainDocumentNavigation);
    }
  }
}
