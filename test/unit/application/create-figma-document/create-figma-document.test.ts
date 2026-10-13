import { describe, expect, test, vi } from 'vitest';

import {
  CreateFigmaDocumentUseCase,
  type CreateFigmaDocumentRequest,
} from '../../../../src/application/create-figma-document/create-figma-document.js';
import type { ExtractionDocument } from '../../../../src/contracts/extraction/extraction-document.js';
import type { ExtractionPort, ExtractionRequest } from '../../../../src/contracts/extraction/extraction-port.js';

const extractionRequest: ExtractionRequest = {
  url: 'https://example.com/page',
  viewport: { width: 1280, height: 720, deviceScaleFactor: 2 },
};

const request: CreateFigmaDocumentRequest = {
  ...extractionRequest,
  includeHidden: false,
};

const extraction: ExtractionDocument = {
  schemaVersion: '1.0',
  source: {
    url: extractionRequest.url,
    viewport: extractionRequest.viewport,
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
      assets: [],
      document: {
        id: 'node-1',
        tag: 'html',
        type: 'FRAME',
        rect: { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0 },
        isVisible: true,
        children: [],
      },
    });
    expect(extractor.extract).toHaveBeenCalledWith(extractionRequest);
  });

  test('filters hidden nodes according to includeHidden without passing it to the extraction port', async () => {
    const extractionWithHiddenNode: ExtractionDocument = {
      ...extraction,
      document: {
        ...extraction.document,
        children: [{
          id: 'node-hidden',
          tagName: 'div',
          attributes: { hidden: '' },
          resources: [],
          text: null,
          styles: {},
          pseudoElements: { before: null, after: null },
          children: [],
        }],
      },
    };
    const extractor: ExtractionPort = { extract: vi.fn().mockResolvedValue(extractionWithHiddenNode) };
    const useCase = new CreateFigmaDocumentUseCase(extractor);

    const hiddenExcluded = await useCase.execute({ ...request, includeHidden: false });
    const hiddenIncluded = await useCase.execute({ ...request, includeHidden: true });

    expect(hiddenExcluded.document.children).toEqual([]);
    expect(hiddenIncluded.document.children).toMatchObject([{ id: 'node-hidden', isVisible: false }]);
    expect(extractor.extract).toHaveBeenNthCalledWith(1, extractionRequest);
    expect(extractor.extract).toHaveBeenNthCalledWith(2, extractionRequest);
  });

  test('propagates extraction errors without attempting to return a partial Figma document', async () => {
    const error = { code: 'UPSTREAM_FAILURE', message: 'The upstream site could not be processed.' };
    const extractor: ExtractionPort = { extract: vi.fn().mockRejectedValue(error) };
    const useCase = new CreateFigmaDocumentUseCase(extractor);

    await expect(useCase.execute(request)).rejects.toBe(error);
  });
});
