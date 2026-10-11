import type { FigmaDocument } from '../../contracts/figma/figma-document.js';
import type { ExtractionPort, ExtractionRequest } from '../../contracts/extraction/extraction-port.js';
import { transformExtractionDocument } from '../../figma/transformer.js';

export class CreateFigmaDocumentUseCase {
  constructor(private readonly extractor: ExtractionPort) {}

  async execute(request: ExtractionRequest): Promise<FigmaDocument> {
    const extraction = await this.extractor.extract(request);
    return transformExtractionDocument(extraction);
  }
}
