import { readFile } from 'node:fs/promises';

import { describe, expect, test } from 'vitest';

import {
  validateExtractionDocumentV1,
  validateFigmaDocumentV1,
} from '../support/json-contract-validator.js';

describe('JSON contract regression', () => {
  test('validates the representative ExtractionDocument example against contract 1.0', async () => {
    const document = await readJsonFixture('extraction-document.1.0.json');

    expect(validateExtractionDocumentV1(document)).toEqual([]);
  });

  test('validates the representative FigmaDocument example against contract 1.0', async () => {
    const document = await readJsonFixture('figma-document.1.0.json');

    expect(validateFigmaDocumentV1(document)).toEqual([]);
  });
});

async function readJsonFixture(fileName: string): Promise<unknown> {
  const fixtureUrl = new URL(`../fixtures/contracts/${fileName}`, import.meta.url);
  return JSON.parse(await readFile(fixtureUrl, 'utf8')) as unknown;
}
