import { describe, expect, test } from 'vitest';

import {
  DEFAULT_VIEWPORT,
  FIXED_RENDERING_ENVIRONMENT,
} from '../../../src/contracts/extraction/defaults.js';
import { VISUAL_PROPERTIES } from '../../../src/browser/visual-properties.js';

describe('extraction defaults', () => {
  test('defines the default 1920 by 1080 viewport at scale factor 1', () => {
    expect(DEFAULT_VIEWPORT).toEqual({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
    });
  });

  test('defines the fixed rendering environment', () => {
    expect(FIXED_RENDERING_ENVIRONMENT).toEqual({
      locale: 'en-US',
      timezone: 'UTC',
      colorScheme: 'light',
      reducedMotion: 'no-preference',
      contrast: 'no-preference',
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    });
  });
});

test('defines the closed list of permitted computed visual properties', () => {
  expect(VISUAL_PROPERTIES).toEqual([
    'display', 'position', 'top', 'right', 'bottom', 'left', 'z-index', 'box-sizing',
    'width', 'min-width', 'max-width', 'height', 'min-height', 'max-height',
    'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'padding-top',
    'padding-right', 'padding-bottom', 'padding-left', 'overflow-x', 'overflow-y',
    'visibility', 'opacity',
    'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
    'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
    'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
    'border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius',
    'border-bottom-left-radius', 'background-color', 'background-image', 'background-size',
    'background-position', 'background-repeat', 'box-shadow', 'outline-width',
    'outline-style', 'outline-color',
    'color', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height',
    'letter-spacing', 'word-spacing', 'text-align', 'text-transform', 'text-decoration-line',
    'text-decoration-style', 'text-decoration-color', 'text-indent', 'white-space',
    'overflow-wrap', 'word-break', 'text-shadow',
    'transform', 'transform-origin', 'filter', 'mix-blend-mode', 'isolation', 'object-fit',
    'object-position', 'cursor', 'pointer-events',
    'flex-direction', 'flex-wrap', 'flex-grow', 'flex-shrink', 'flex-basis',
    'justify-content', 'align-items', 'align-content', 'align-self', 'order', 'gap',
    'row-gap', 'column-gap', 'grid-auto-flow', 'grid-template-columns', 'grid-template-rows',
    'grid-column-start', 'grid-column-end', 'grid-row-start', 'grid-row-end', 'place-items',
    'place-content',
  ]);
});
