import { describe, expect, test } from 'vitest';

import {
  normalizeFigmaQuery,
  type FigmaQuery,
} from '../../../../src/http/schemas/figma-query.js';

function expectInvalidRequest(query: FigmaQuery): void {
  try {
    normalizeFigmaQuery(query);
    throw new Error('Expected query normalization to fail.');
  } catch (error) {
    expect(error).toMatchObject({
      code: 'INVALID_REQUEST',
      message: 'The includeHidden query parameter must be true or false.',
    });
  }
}

describe('normalizeFigmaQuery', () => {
  test('defaults includeHidden to false when it is omitted', () => {
    expect(normalizeFigmaQuery({ url: 'https://example.com' })).toMatchObject({
      includeHidden: false,
    });
  });

  test.each([
    ['true', true],
    ['false', false],
  ])('normalizes includeHidden=%s', (includeHidden, expected) => {
    expect(
      normalizeFigmaQuery({ url: 'https://example.com', includeHidden }),
    ).toMatchObject({ includeHidden: expected });
  });

  test.each(['TRUE', 'False', '1', 'yes', ''])('rejects an invalid includeHidden value: %s', (includeHidden) => {
    expectInvalidRequest({ url: 'https://example.com', includeHidden });
  });
});
