import type { Browser, BrowserContext, Frame, Page, Route, Response } from 'playwright';

import {
  MainDocumentRedirectError,
  UpstreamFailureError,
} from '../contracts/errors/application-error.js';
import type { ExtractionRequest } from '../contracts/extraction/extraction-port.js';
import { FIXED_RENDERING_ENVIRONMENT } from '../contracts/extraction/defaults.js';
import {
  enforcePublicUrlPolicy,
  PublicUrlPolicyError,
  type RuntimeEnvironment,
} from '../security/url-policy/public-url-policy.js';

const POST_LOAD_SERIALIZATION_DELAY_MS = 30_000;

/**
 * Creates isolated Playwright contexts configured for reproducible extraction.
 * Navigation and document serialization are added by subsequent extraction tasks.
 */
export class PlaywrightExtractor {
  constructor(
    private readonly browser: Browser,
    private readonly environment: RuntimeEnvironment = 'production',
  ) {}

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
    let nonPublicDestinationError: PublicUrlPolicyError | undefined;
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
    const enforceMainDocumentDestinationPolicy = async (route: Route): Promise<void> => {
      const navigationRequest = route.request();
      const isMainDocumentNavigation =
        navigationRequest.isNavigationRequest() && navigationRequest.frame() === page.mainFrame();

      if (!isMainDocumentNavigation) {
        await route.continue();
        return;
      }

      try {
        enforcePublicUrlPolicy(new URL(navigationRequest.url()), this.environment);
      } catch (error) {
        if (error instanceof PublicUrlPolicyError) {
          nonPublicDestinationError = error;
          await route.abort();
          return;
        }

        throw error;
      }

      await route.continue();
    };

    page.on('response', detectMainDocumentRedirect);
    page.on('framenavigated', detectSubsequentMainDocumentNavigation);
    await page.route('**/*', enforceMainDocumentDestinationPolicy);
    try {
      const response = await page.goto(url);
      if (nonPublicDestinationError !== undefined) {
        throw nonPublicDestinationError;
      }

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
      if (nonPublicDestinationError !== undefined) {
        throw nonPublicDestinationError;
      }

      if (error instanceof PublicUrlPolicyError) {
        throw error;
      }

      if (error instanceof MainDocumentRedirectError) {
        throw error;
      }

      throw new UpstreamFailureError();
    } finally {
      page.off('response', detectMainDocumentRedirect);
      page.off('framenavigated', detectSubsequentMainDocumentNavigation);
      await page.unroute('**/*', enforceMainDocumentDestinationPolicy);
    }
  }
}
