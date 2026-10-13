import type { FastifyInstance } from 'fastify';

import type { CreateFigmaDocumentUseCase } from '../../application/create-figma-document/create-figma-document.js';
import { normalizeFigmaQuery, type FigmaQuery } from '../schemas/figma-query.js';

export function registerFigmaRoute(
  application: FastifyInstance,
  createFigmaDocument: Pick<CreateFigmaDocumentUseCase, 'execute'>,
): void {
  application.get<{ Querystring: FigmaQuery }>('/v1/figma', async (request) => {
    const normalizedRequest = normalizeFigmaQuery(request.query);
    const extractionRequest = {
      url: normalizedRequest.url,
      viewport: normalizedRequest.viewport,
    };
    return createFigmaDocument.execute(extractionRequest);
  });
}
