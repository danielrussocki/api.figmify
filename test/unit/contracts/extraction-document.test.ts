import { expectTypeOf, test } from 'vitest';

import type {
  ExtractionDocument,
  ExtractionNode,
  RenderingEnvironment,
  ResourceReference,
  Viewport,
} from '../../../src/contracts/extraction/extraction-document.js';

test('models the versioned extraction document contract', () => {
  const viewport: Viewport = {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
  };

  const environment: RenderingEnvironment = {
    locale: 'en-US',
    timezone: 'UTC',
    colorScheme: 'light',
    reducedMotion: 'no-preference',
  };

  const resource: ResourceReference = {
    kind: 'image',
    url: 'https://example.com/logo.svg',
  };

  const node: ExtractionNode = {
    id: 'node-1',
    tagName: 'body',
    attributes: { class: 'page' },
    resources: [resource],
    text: null,
    styles: { display: 'block' },
    pseudoElements: {
      before: { content: '""', styles: { display: 'inline' } },
      after: null,
    },
    children: [],
    shadowChildren: [],
  };

  const document: ExtractionDocument = {
    schemaVersion: '1.0',
    source: {
      url: 'https://example.com/',
      viewport,
      environment,
    },
    document: node,
  };

  expectTypeOf(document.schemaVersion).toEqualTypeOf<'1.0'>();
  expectTypeOf(document.source.viewport).toEqualTypeOf<Viewport>();
  expectTypeOf(document.source.environment).toEqualTypeOf<RenderingEnvironment>();
  expectTypeOf(document.document.pseudoElements.before).toEqualTypeOf<
    { content: string | null; styles: Record<string, string> } | null
  >();
  expectTypeOf(document.document.resources).toEqualTypeOf<ResourceReference[]>();
});
