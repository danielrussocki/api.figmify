import type { FigmaDocument } from '../../contracts/figma/figma-document.js';
import type { ExtractionPort, ExtractionRequest } from '../../contracts/extraction/extraction-port.js';
import { transformExtractionDocument } from '../../figma/transformer.js';

export interface CreateFigmaDocumentRequest extends ExtractionRequest {
  includeHidden: boolean;
}

export class CreateFigmaDocumentUseCase {
  constructor(private readonly extractor: ExtractionPort) {}

  async execute(request: CreateFigmaDocumentRequest): Promise<FigmaDocument> {
    const { includeHidden, ...extractionRequest } = request;
    const extraction = await this.extractor.extract(extractionRequest);
    return transformExtractionDocument(extraction, { includeHidden });
  }
}
