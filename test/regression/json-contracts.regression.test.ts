import { readdir, readFile } from 'node:fs/promises';

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

  test('rejects an extraction node with incomplete layout metadata', async () => {
    const document = await readJsonFixture('extraction-document.1.0.json') as {
      document: { layout: { rect: Record<string, unknown> } };
    };
    delete document.document.layout.rect.width;

    expect(validateExtractionDocumentV1(document)).toContain('$.document.layout.rect.width is required.');
  });

  test('rejects a direct text run without its ordered position or effective styles', async () => {
    const document = await readJsonFixture('extraction-document.1.0.json') as {
      document: { directTextRuns: Array<Record<string, unknown>> };
    };
    delete document.document.directTextRuns[0]?.childNodeIndex;
    delete document.document.directTextRuns[0]?.styles;

    expect(validateExtractionDocumentV1(document)).toEqual(expect.arrayContaining([
      '$.document.directTextRuns[0].childNodeIndex is required.',
      '$.document.directTextRuns[0].styles is required.',
    ]));
  });

  test('rejects the legacy Figma node shape', () => {
    const legacyDocument = {
      schemaVersion: '1.0',
      source: { url: 'https://example.com/', viewport: { width: 1920, height: 1080, deviceScaleFactor: 1 } },
      styles: { colors: [], typographies: [] },
      document: {
        sourceId: 'node-1', type: 'DOCUMENT', name: 'html', attributes: {}, resources: {}, styles: {}, children: [],
      },
    };

    expect(validateFigmaDocumentV1(legacyDocument)).toEqual(expect.arrayContaining([
      '$.assets is required.',
      '$.document.id is required.',
      '$.document.rect is required.',
    ]));
  });

  test('contains no persistence implementation and justifies every direct dependency', async () => {
    const manifest = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      figmify?: { dependencyJustifications?: Record<string, string> };
    };
    const dependencies = { ...manifest.dependencies, ...manifest.devDependencies };

    for (const dependency of Object.keys(dependencies)) {
      expect(manifest.figmify?.dependencyJustifications?.[dependency]).toMatch(/\S/);
    }

    const source = await readSourceTree(new URL('../../src/', import.meta.url));
    expect(source).not.toMatch(/from ['"](?:node:)?fs(?:\/promises)?['"]|\b(?:writeFile|appendFile|mkdir|createWriteStream)\s*\(/u);
    expect(source).not.toMatch(/\b(?:database|redis|sqlite|postgres|mongodb|queue)\b/iu);
  });
});

async function readJsonFixture(fileName: string): Promise<unknown> {
  const fixtureUrl = new URL(`../fixtures/contracts/${fileName}`, import.meta.url);
  return JSON.parse(await readFile(fixtureUrl, 'utf8')) as unknown;
}

async function readSourceTree(directory: URL): Promise<string> {
  const entries = await readdir(directory, { withFileTypes: true });
  const contents = await Promise.all(entries.map(async (entry) => {
    const entryUrl = new URL(entry.name, directory);
    if (entry.isDirectory()) return readSourceTree(new URL(`${entry.name}/`, directory));
    return entry.isFile() && entry.name.endsWith('.ts') ? readFile(entryUrl, 'utf8') : '';
  }));
  return contents.join('\n');
}
