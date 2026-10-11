import type { ExtractionDocument, Viewport } from './extraction-document.js';

export interface ExtractionRequest {
  url: string;
  viewport: Viewport;
}

export interface ExtractionPort {
  extract(request: ExtractionRequest): Promise<ExtractionDocument>;
}
