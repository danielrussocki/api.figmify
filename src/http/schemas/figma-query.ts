import type { ExtractionRequest } from '../../contracts/extraction/extraction-port.js';
import {
  normalizeExtractionQuery,
  QueryNormalizationError,
  type ExtractionQuery,
} from './extraction-query.js';

export interface FigmaQuery extends ExtractionQuery {
  includeHidden?: unknown;
}

export interface NormalizedFigmaRequest extends ExtractionRequest {
  includeHidden: boolean;
}

export function normalizeFigmaQuery(query: FigmaQuery): NormalizedFigmaRequest {
  return {
    ...normalizeExtractionQuery(query),
    includeHidden: normalizeIncludeHidden(query.includeHidden),
  };
}

function normalizeIncludeHidden(value: unknown): boolean {
  if (value === undefined) {
    return false;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  throw new QueryNormalizationError(
    'The includeHidden query parameter must be true or false.',
  );
}
