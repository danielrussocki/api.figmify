import type { RenderingEnvironment, Viewport } from './extraction-document.js';

export const DEFAULT_VIEWPORT = {
  width: 1920,
  height: 1080,
  deviceScaleFactor: 1,
} as const satisfies Viewport;

export const FIXED_RENDERING_ENVIRONMENT = {
  locale: 'en-US',
  timezone: 'UTC',
  colorScheme: 'light',
  reducedMotion: 'no-preference',
  contrast: 'no-preference',
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
} as const satisfies RenderingEnvironment & {
  contrast: 'no-preference';
  userAgent: string;
};
