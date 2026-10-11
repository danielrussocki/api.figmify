import type { Viewport } from '../../contracts/extraction/extraction-document.js';
import { DEFAULT_VIEWPORT } from '../../contracts/extraction/defaults.js';

export interface ExtractionQuery {
  url?: unknown;
  width?: unknown;
  height?: unknown;
  deviceScaleFactor?: unknown;
}

export interface NormalizedExtractionRequest {
  url: string;
  viewport: Viewport;
}

export class QueryNormalizationError extends Error {
  readonly code = 'INVALID_REQUEST' as const;

  constructor(message: string) {
    super(message);
    this.name = 'QueryNormalizationError';
  }
}

export function normalizeExtractionQuery(
  query: ExtractionQuery,
): NormalizedExtractionRequest {
  return {
    url: normalizeUrl(query.url),
    viewport: {
      width: normalizeDimension('width', query.width, DEFAULT_VIEWPORT.width),
      height: normalizeDimension('height', query.height, DEFAULT_VIEWPORT.height),
      deviceScaleFactor: normalizeDeviceScaleFactor(query.deviceScaleFactor),
    },
  };
}

function normalizeUrl(value: unknown): string {
  if (typeof value !== 'string') {
    throw new QueryNormalizationError(
      'The url query parameter must be an absolute HTTP or HTTPS URL.',
    );
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new QueryNormalizationError(
      'The url query parameter must be an absolute HTTP or HTTPS URL.',
    );
  }

  if ((url.protocol !== 'http:' && url.protocol !== 'https:') || !url.hostname) {
    throw new QueryNormalizationError(
      'The url query parameter must be an absolute HTTP or HTTPS URL.',
    );
  }

  return url.href;
}

function normalizeDimension(
  name: 'width' | 'height',
  value: unknown,
  defaultValue: number,
): number {
  if (value === undefined) {
    return defaultValue;
  }

  if (!isIntegerInRange(value, 1, 3840)) {
    throw new QueryNormalizationError(
      `The ${name} query parameter must be an integer between 1 and 3840.`,
    );
  }

  return Number(value);
}

function normalizeDeviceScaleFactor(value: unknown): Viewport['deviceScaleFactor'] {
  if (value === undefined) {
    return DEFAULT_VIEWPORT.deviceScaleFactor;
  }

  if (!isIntegerInRange(value, 1, 3)) {
    throw new QueryNormalizationError(
      'The deviceScaleFactor query parameter must be 1, 2, or 3.',
    );
  }

  return Number(value) as Viewport['deviceScaleFactor'];
}

function isIntegerInRange(value: unknown, minimum: number, maximum: number): boolean {
  if (typeof value !== 'string' || !/^-?\d+$/.test(value)) {
    return false;
  }

  const numberValue = Number(value);
  return Number.isSafeInteger(numberValue) && numberValue >= minimum && numberValue <= maximum;
}
