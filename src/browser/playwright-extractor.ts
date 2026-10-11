import type { Browser, BrowserContext } from 'playwright';

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
}
