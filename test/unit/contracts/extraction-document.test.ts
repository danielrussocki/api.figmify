import { expectTypeOf, test } from 'vitest';

import type {
  DirectTextRun,
  DocumentRect,
  ExtractionDocument,
  ExtractionLayout,
  ExtractionNode,
  ObjectFit,
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

  const rect: DocumentRect = {
    x: 24,
    y: 32,
    width: 180,
    height: 39,
    top: 32,
    left: 24,
  };

  const layout: ExtractionLayout = {
    rect,
    hasOffsetParent: true,
    offsetParentId: 'node-1',
    naturalWidth: 360,
    naturalHeight: 78,
    objectFit: 'cover',
  };

  const node: ExtractionNode = {
    id: 'node-1',
    tagName: 'body',
    attributes: { class: 'page' },
    resources: [resource],
    text: null,
    layout,
    styles: { display: 'block' },
    pseudoElements: {
      before: { content: '""', styles: { display: 'inline' } },
      after: null,
    },
    directTextRuns: [{
      characters: 'Hello ',
      childNodeIndex: 0,
      styles: { color: 'rgb(17, 24, 39)', 'font-size': '16px' },
    }],
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
  expectTypeOf(document.document.directTextRuns).toEqualTypeOf<DirectTextRun[] | undefined>();
  expectTypeOf(node.directTextRuns?.[0]?.characters).toEqualTypeOf<string | undefined>();
  expectTypeOf(node.directTextRuns?.[0]?.childNodeIndex).toEqualTypeOf<number | undefined>();
  expectTypeOf(node.directTextRuns?.[0]?.styles).toEqualTypeOf<Record<string, string> | undefined>();
  expectTypeOf(document.document.layout).toEqualTypeOf<ExtractionLayout | undefined>();
  expectTypeOf(layout.rect).toEqualTypeOf<DocumentRect>();
  expectTypeOf(layout.rect.x).toEqualTypeOf<number>();
  expectTypeOf(layout.rect.y).toEqualTypeOf<number>();
  expectTypeOf(layout.rect.width).toEqualTypeOf<number>();
  expectTypeOf(layout.rect.height).toEqualTypeOf<number>();
  expectTypeOf(layout.rect.top).toEqualTypeOf<number>();
  expectTypeOf(layout.rect.left).toEqualTypeOf<number>();
  expectTypeOf(layout.offsetParentId).toEqualTypeOf<string | undefined>();
  expectTypeOf(layout.hasOffsetParent).toEqualTypeOf<boolean | undefined>();
  expectTypeOf(layout.naturalWidth).toEqualTypeOf<number | undefined>();
  expectTypeOf(layout.naturalHeight).toEqualTypeOf<number | undefined>();
  expectTypeOf(layout.objectFit).toEqualTypeOf<ObjectFit | undefined>();
});
