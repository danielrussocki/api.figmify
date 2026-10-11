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
});
