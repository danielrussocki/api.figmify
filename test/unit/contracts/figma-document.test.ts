import { expectTypeOf, test } from 'vitest';

import type { Viewport } from '../../../src/contracts/extraction/extraction-document.js';
import type {
  ColorStyle,
  ColorStyleId,
  FigmaDocument,
  FigmaDropShadowEffect,
  FigmaEffect,
  FigmaFills,
  FigmaIsVisible,
  FigmaNode,
  FigmaNodeType,
  FigmaPaint,
  FigmaRect,
  FigmaRelativeRect,
  FigmaRgbaColor,
  FigmaStyleCatalog,
  FigmaStrokes,
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

test('models compact Figma nodes with required geometry and only permitted types', () => {
  const root: FigmaNode = {
    id: 'node-1',
    tag: 'body',
    type: 'FRAME',
    rect: { x: 0, y: 0, width: 1920, height: 1080, top: 0, left: 0 },
    isVisible: true,
    children: [],
  };
  const child: FigmaNode = {
    id: 'node-2',
    tag: 'img',
    type: 'IMAGE',
    rect: { x: 24, y: 32, width: 180, height: 39, top: 32, left: 24 },
    relativeRect: { x: 24, y: 32, width: 180, height: 39, top: 32, left: 24 },
    isVisible: false,
    children: [],
  };

  expectTypeOf(root.id).toEqualTypeOf<string>();
  expectTypeOf(root.tag).toEqualTypeOf<string>();
  expectTypeOf(root.type).toEqualTypeOf<'FRAME' | 'TEXT' | 'IMAGE'>();
  expectTypeOf(root.rect).toEqualTypeOf<FigmaRect>();
  expectTypeOf(root.isVisible).toEqualTypeOf<FigmaIsVisible>();
  expectTypeOf(root.relativeRect).toEqualTypeOf<FigmaRelativeRect | undefined>();
  expectTypeOf(child.relativeRect).toEqualTypeOf<FigmaRelativeRect | undefined>();
});

test('models structured paints, strokes, drop shadows, and corner radii', () => {
  const rgba: FigmaRgbaColor = { r: 0.067, g: 0.094, b: 0.153, a: 0.8 };
  const paint: FigmaPaint = { type: 'SOLID', color: rgba };
  const fills: FigmaFills = [paint];
  const strokes: FigmaStrokes = [{ type: 'SOLID', color: rgba, weight: 2 }];
  const effect: FigmaDropShadowEffect = {
    type: 'DROP_SHADOW',
    color: { r: 0, g: 0, b: 0, a: 0.25 },
    offset: { x: 0, y: 4 },
    radius: 8,
    spread: 1,
  };
  const node: FigmaNode = {
    id: 'node-3',
    tag: 'section',
    type: 'FRAME',
    rect: { x: 0, y: 0, width: 100, height: 100, top: 0, left: 0 },
    isVisible: true,
    fills,
    strokes,
    effects: [effect],
    cornerRadius: 8,
    cornerRadii: { topLeft: 8, topRight: 4, bottomRight: 2, bottomLeft: 0 },
    children: [],
  };

  expectTypeOf(rgba.r).toEqualTypeOf<number>();
  expectTypeOf(rgba.g).toEqualTypeOf<number>();
  expectTypeOf(rgba.b).toEqualTypeOf<number>();
  expectTypeOf(rgba.a).toEqualTypeOf<number>();
  expectTypeOf(paint).toEqualTypeOf<FigmaPaint>();
  expectTypeOf<FigmaFills>().toEqualTypeOf<FigmaPaint[] | null>();
  expectTypeOf<FigmaStrokes>().toEqualTypeOf<
    | { type: 'SOLID'; color: FigmaRgbaColor; weight: number }[]
    | null
  >();
  expectTypeOf(effect).toEqualTypeOf<FigmaEffect>();
  expectTypeOf(effect.type).toEqualTypeOf<'DROP_SHADOW'>();
  expectTypeOf(effect.offset.x).toEqualTypeOf<number>();
  expectTypeOf(effect.offset.y).toEqualTypeOf<number>();
  expectTypeOf(effect.radius).toEqualTypeOf<number>();
  expectTypeOf(effect.spread).toEqualTypeOf<number>();
  expectTypeOf(node.cornerRadius).toEqualTypeOf<number | undefined>();
  expectTypeOf(node.cornerRadii).toEqualTypeOf<
    | { topLeft: number; topRight: number; bottomRight: number; bottomLeft: number }
    | undefined
  >();
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

  const node: FigmaNode = {
    id: 'node-2',
    tag: 'h1',
    type: 'TEXT',
    rect: { x: 24, y: 32, width: 180, height: 39, top: 32, left: 24 },
    isVisible: true,
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
  expectTypeOf(document.document.id).toEqualTypeOf<string>();
  expectTypeOf(document.document.tag).toEqualTypeOf<string>();
  expectTypeOf(document.document.rect).toEqualTypeOf<FigmaRect>();
});
