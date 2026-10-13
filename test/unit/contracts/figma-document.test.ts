import { expectTypeOf, test } from 'vitest';

import type { ResourceReference, Viewport } from '../../../src/contracts/extraction/extraction-document.js';
import type {
  ColorStyle,
  ColorStyleId,
  FigmaDocument,
  FigmaIsVisible,
  FigmaNode,
  FigmaNodeType,
  FigmaRect,
  FigmaRelativeRect,
  FigmaRgbaColor,
  FigmaStyleCatalog,
  TypographyStyle,
  TypographyStyleId,
} from '../../../src/contracts/figma/figma-document.js';

test('models Figma absolute and relative rectangles with typed visibility', () => {
  const rect: FigmaRect = {
    x: 24,
    y: 32,
    width: 180,
    height: 39,
    top: 32,
    left: 24,
  };
  const relativeRect: FigmaRelativeRect = {
    x: 24,
    y: 32,
    width: 180,
    height: 39,
    top: 32,
    left: 24,
  };
  const isVisible: FigmaIsVisible = true;

  expectTypeOf(rect).toEqualTypeOf<FigmaRect>();
  expectTypeOf(relativeRect).toEqualTypeOf<FigmaRelativeRect>();
  expectTypeOf(isVisible).toEqualTypeOf<boolean>();
  expectTypeOf(rect.x).toEqualTypeOf<number>();
  expectTypeOf(rect.y).toEqualTypeOf<number>();
  expectTypeOf(rect.width).toEqualTypeOf<number>();
  expectTypeOf(rect.height).toEqualTypeOf<number>();
  expectTypeOf(rect.top).toEqualTypeOf<number>();
  expectTypeOf(rect.left).toEqualTypeOf<number>();
  expectTypeOf(relativeRect).toEqualTypeOf<FigmaRect>();
});

test('models the versioned Figma document contract and reusable style catalogs', () => {
  const viewport: Viewport = {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
  };

  const colorId: ColorStyleId = 'color-111827';
  const typographyId: TypographyStyleId = 'type-inter-32-700-normal-38.4-0-none';
  const rgba: FigmaRgbaColor = { r: 0.067, g: 0.094, b: 0.153, a: 1 };

  const color: ColorStyle = {
    id: colorId,
    name: '#111827',
    rgba,
  };

  const typography: TypographyStyle = {
    id: typographyId,
    fontFamily: 'Inter, sans-serif',
    fontSize: '32px',
    fontWeight: '700',
    fontStyle: 'normal',
    lineHeight: '38.4px',
    letterSpacing: 'normal',
    textTransform: 'none',
  };

  const styles: FigmaStyleCatalog = {
    colors: [color],
    typographies: [typography],
  };

  const resource: ResourceReference = {
    kind: 'image',
    url: 'https://example.com/logo.svg',
  };

  const node: FigmaNode = {
    sourceId: 'node-2',
    type: 'TEXT',
    name: 'h1',
    characters: 'Welcome',
    attributes: { id: 'welcome' },
    resources: [resource],
    fillStyleId: colorId,
    textStyleId: typographyId,
    styles: { fontSize: 32, fontWeight: 700 },
    children: [],
  };

  const document: FigmaDocument = {
    schemaVersion: '1.0',
    source: {
      url: 'https://example.com/',
      viewport,
    },
    styles,
    document: node,
  };

  expectTypeOf(document.schemaVersion).toEqualTypeOf<'1.0'>();
  expectTypeOf(document.source.viewport).toEqualTypeOf<Viewport>();
  expectTypeOf(document.styles.colors).toEqualTypeOf<ColorStyle[]>();
  expectTypeOf(document.styles.typographies).toEqualTypeOf<TypographyStyle[]>();
  expectTypeOf(document.document.type).toEqualTypeOf<FigmaNodeType>();
  expectTypeOf(document.document.sourceId).toEqualTypeOf<string>();
  expectTypeOf(document.document.fillStyleId).toEqualTypeOf<ColorStyleId | undefined>();
  expectTypeOf(document.document.textStyleId).toEqualTypeOf<TypographyStyleId | undefined>();
  expectTypeOf(document.document.resources).toEqualTypeOf<ResourceReference[]>();
});
