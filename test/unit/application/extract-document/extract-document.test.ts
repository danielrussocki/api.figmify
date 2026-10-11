import { describe, expect, test, vi } from 'vitest';

import type { ExtractionDocument } from '../../../../src/contracts/extraction/extraction-document.js';
import type { ExtractionPort } from '../../../../src/contracts/extraction/extraction-port.js';
import { ExtractDocumentUseCase } from '../../../../src/application/extract-document/extract-document.js';

const request = {
  url: 'https://example.com/page',
  viewport: { width: 1280, height: 720, deviceScaleFactor: 2 as const },
};

const document: ExtractionDocument = {
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

function createExtractor(): ExtractionPort {
  return { extract: vi.fn().mockResolvedValue(document) };
}

describe('ExtractDocumentUseCase', () => {
  test('enforces the public URL policy before delegating the normalized request to the extraction port', async () => {
    const extractor = createExtractor();
    const useCase = new ExtractDocumentUseCase(extractor, 'production');

    await expect(useCase.execute(request)).resolves.toBe(document);
    expect(extractor.extract).toHaveBeenCalledWith(request);
  });

  test('does not call the extraction port when the production URL is not public', async () => {
    const extractor = createExtractor();
    const useCase = new ExtractDocumentUseCase(extractor, 'production');

    await expect(
      useCase.execute({ ...request, url: 'http://127.0.0.1/private' }),
    ).rejects.toMatchObject({ code: 'URL_NOT_PUBLIC' });
    expect(extractor.extract).not.toHaveBeenCalled();
  });

  test('allows development URLs according to the URL policy', async () => {
    const extractor = createExtractor();
    const useCase = new ExtractDocumentUseCase(extractor, 'development');
    const developmentRequest = { ...request, url: 'http://127.0.0.1/private' };

    await expect(useCase.execute(developmentRequest)).resolves.toBe(document);
    expect(extractor.extract).toHaveBeenCalledWith(developmentRequest);
  });
});
