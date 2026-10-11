import type { FastifyInstance } from 'fastify';

import type { ExtractDocumentUseCase } from '../../application/extract-document/extract-document.js';
import { normalizeExtractionQuery, type ExtractionQuery } from '../schemas/extraction-query.js';

export function registerExtractRoute(
  application: FastifyInstance,
  extractDocument: Pick<ExtractDocumentUseCase, 'execute'>,
): void {
  application.get<{ Querystring: ExtractionQuery }>('/v1/extract', async (request) => {
    const extractionRequest = normalizeExtractionQuery(request.query);
    return extractDocument.execute(extractionRequest);
  });
}
