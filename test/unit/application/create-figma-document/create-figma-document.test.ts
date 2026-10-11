import { describe, expect, test, vi } from 'vitest';

import { CreateFigmaDocumentUseCase } from '../../../../src/application/create-figma-document/create-figma-document.js';
import type { ExtractionDocument } from '../../../../src/contracts/extraction/extraction-document.js';
import type { ExtractionPort, ExtractionRequest } from '../../../../src/contracts/extraction/extraction-port.js';

const request: ExtractionRequest = {
  url: 'https://example.com/page',
  viewport: { width: 1280, height: 720, deviceScaleFactor: 2 },
};

const extraction: ExtractionDocument = {
  schemaVersion: '1.0',
  source: {
    url: request.url,
    viewport: request.viewport,
    environment: {
      locale: 'en-US',
      timezone: 'UTC',
      colorScheme: 'light',
      reducedMotion: 'no-preference',
    },
  },
  document: {
    id: 'node-1',
    tagName: 'html',
    attributes: {},
    resources: [],
    text: null,
    styles: {},
    pseudoElements: { before: null, after: null },
    children: [],
  },
};

describe('CreateFigmaDocumentUseCase', () => {
  test('extracts the document through the port and transforms it into the Figma contract', async () => {
    const extractor: ExtractionPort = { extract: vi.fn().mockResolvedValue(extraction) };
    const useCase = new CreateFigmaDocumentUseCase(extractor);

    await expect(useCase.execute(request)).resolves.toEqual({
      schemaVersion: '1.0',
      source: { url: request.url, viewport: request.viewport },
      styles: { colors: [], typographies: [] },
      document: {
        sourceId: 'node-1',
        type: 'DOCUMENT',
        name: 'html',
        attributes: {},
        resources: [],
        styles: {},
        children: [],
      },
    });
    expect(extractor.extract).toHaveBeenCalledWith(request);
  });

  test('propagates extraction errors without attempting to return a partial Figma document', async () => {
    const error = { code: 'UPSTREAM_FAILURE', message: 'The upstream site could not be processed.' };
    const extractor: ExtractionPort = { extract: vi.fn().mockRejectedValue(error) };
    const useCase = new CreateFigmaDocumentUseCase(extractor);

    await expect(useCase.execute(request)).rejects.toBe(error);
  });
});
