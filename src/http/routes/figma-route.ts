import type { FastifyInstance } from 'fastify';

import type { CreateFigmaDocumentUseCase } from '../../application/create-figma-document/create-figma-document.js';
import { normalizeExtractionQuery, type ExtractionQuery } from '../schemas/extraction-query.js';

export function registerFigmaRoute(
  application: FastifyInstance,
  createFigmaDocument: Pick<CreateFigmaDocumentUseCase, 'execute'>,
): void {
  application.get<{ Querystring: ExtractionQuery }>('/v1/figma', async (request) => {
    const extractionRequest = normalizeExtractionQuery(request.query);
    return createFigmaDocument.execute(extractionRequest);
  });
}
