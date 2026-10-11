import { describe, expect, test } from 'vitest';

import {
  normalizeExtractionQuery,
  type ExtractionQuery,
} from '../../../../src/http/schemas/extraction-query.js';

function expectInvalidRequest(query: ExtractionQuery): void {
  try {
    normalizeExtractionQuery(query);
    throw new Error('Expected query normalization to fail.');
  } catch (error) {
    expect(error).toMatchObject({ code: 'INVALID_REQUEST' });
  }
}

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

  test('rejects a missing URL', () => {
    expectInvalidRequest({});
  });

  test.each(['example.com', '/page'])('rejects a non-absolute URL: %s', (url) => {
    expectInvalidRequest({ url });
  });

  test.each(['ftp://example.com/file', 'file:///tmp/page.html', 'javascript:alert(1)'])(
    'rejects a URL with a non-HTTP(S) scheme: %s',
    (url) => {
      expectInvalidRequest({ url });
    },
  );

  test.each([
    ['width', '1.5'],
    ['height', 'not-a-number'],
    ['width', '0'],
    ['height', '3841'],
  ] as const)('rejects a non-integer or out-of-range %s: %s', (name, value) => {
    expectInvalidRequest({
      url: 'https://example.com',
      [name]: value,
    });
  });

  test.each(['0', '4', '1.5', 'not-a-number'])(
    'rejects a disallowed device scale factor: %s',
    (deviceScaleFactor) => {
      expectInvalidRequest({
        url: 'https://example.com',
        deviceScaleFactor,
      });
    },
  );
});
