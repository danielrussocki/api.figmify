import { describe, expect, test } from 'vitest';

import { normalizeExtractionQuery } from '../../../../src/http/schemas/extraction-query.js';

describe('normalizeExtractionQuery', () => {
  test('normalizes a valid URL and configured viewport', () => {
    expect(
      normalizeExtractionQuery({
        url: 'HTTPS://Example.COM:443/page?mode=full#section',
        width: '1280',
        height: '720',
        deviceScaleFactor: '2',
      }),
    ).toEqual({
      url: 'https://example.com/page?mode=full#section',
      viewport: {
        width: 1280,
        height: 720,
        deviceScaleFactor: 2,
      },
    });
  });

  test('uses the default viewport when its parameters are omitted', () => {
    expect(
      normalizeExtractionQuery({ url: 'https://example.com' }),
    ).toEqual({
      url: 'https://example.com/',
      viewport: {
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1,
      },
    });
  });

  test.each([
    [1, 1],
    [3840, 3840],
  ])('accepts viewport dimensions at the valid boundary %i', (width, height) => {
    expect(
      normalizeExtractionQuery({
        url: 'https://example.com',
        width: String(width),
        height: String(height),
      }),
    ).toMatchObject({
      viewport: { width, height, deviceScaleFactor: 1 },
    });
  });

  test.each([1, 2, 3])(
    'accepts the allowed device scale factor %i',
    (deviceScaleFactor) => {
      expect(
        normalizeExtractionQuery({
          url: 'https://example.com',
          deviceScaleFactor: String(deviceScaleFactor),
        }),
      ).toMatchObject({
        viewport: { deviceScaleFactor },
      });
    },
  );
});
