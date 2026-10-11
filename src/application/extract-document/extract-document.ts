import type { ExtractionPort, ExtractionRequest } from '../../contracts/extraction/extraction-port.js';
import type { RuntimeEnvironment } from '../../security/url-policy/public-url-policy.js';
import { enforcePublicUrlPolicy } from '../../security/url-policy/public-url-policy.js';

export class ExtractDocumentUseCase {
  constructor(
    private readonly extractor: ExtractionPort,
    private readonly environment: RuntimeEnvironment,
  ) {}

  async execute(request: ExtractionRequest) {
    enforcePublicUrlPolicy(new URL(request.url), this.environment);
    return this.extractor.extract(request);
  }
}
