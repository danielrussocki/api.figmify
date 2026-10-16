import { expectTypeOf, test } from 'vitest';

import type { Viewport } from '../../../src/contracts/extraction/extraction-document.js';
import type {
  ColorStyle,
  ColorStyleId,
  FigmaDocument,
  FigmaDropShadowEffect,
  FigmaEffect,
  FigmaInnerShadowEffect,
  FigmaFills,
  FigmaFontAsset,
  FigmaElementImageData,
  FigmaImagePaint,
  FigmaImageScaleMode,
  FigmaIsVisible,
  FigmaCounterAxisAlign,
  FigmaPadding,
  FigmaPrimaryAxisAlign,
  FigmaNode,
  FigmaNodeType,
  FigmaPaint,
  FigmaRect,
  FigmaRelativeRect,
  FigmaRgbaColor,
  FigmaSolidPaint,
  FigmaStyleCatalog,
  FigmaStrokes,
  FigmaStrokeSide,
  FigmaStrokeWeights,
  FigmaTextAutoResize,
  FigmaTextStyle,
  FigmaTextAlign,
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
    opacity: 0.8,
    children: [],
  };

  expectTypeOf(root.id).toEqualTypeOf<string>();
  expectTypeOf(root.tag).toEqualTypeOf<string>();
  expectTypeOf(root.type).toEqualTypeOf<'FRAME' | 'TEXT' | 'IMAGE'>();
  expectTypeOf(root.rect).toEqualTypeOf<FigmaRect>();
  expectTypeOf(root.isVisible).toEqualTypeOf<FigmaIsVisible>();
  expectTypeOf(root.relativeRect).toEqualTypeOf<FigmaRelativeRect | undefined>();
  expectTypeOf(child.relativeRect).toEqualTypeOf<FigmaRelativeRect | undefined>();
  expectTypeOf(child.opacity).toEqualTypeOf<number | undefined>();
});

test('models optional Auto Layout values with their Figma value domains', () => {
  const padding: FigmaPadding = {
    top: 16,
    right: 20,
    bottom: 16,
    left: 20,
  };
  const primaryAxisAlign: FigmaPrimaryAxisAlign = 'SPACE_BETWEEN';
  const counterAxisAlign: FigmaCounterAxisAlign = 'CENTER';
  const node: FigmaNode = {
    id: 'node-auto-layout',
    tag: 'section',
    type: 'FRAME',
    rect: { x: 0, y: 0, width: 100, height: 100, top: 0, left: 0 },
    isVisible: true,
    layoutMode: 'HORIZONTAL',
    itemSpacing: 12,
    gap: 12,
    padding,
    primaryAxisAlign,
    counterAxisAlign,
    layoutGrow: 1,
    children: [],
  };

  expectTypeOf(node.layoutMode).toEqualTypeOf<'HORIZONTAL' | 'VERTICAL' | undefined>();
  expectTypeOf(node.itemSpacing).toEqualTypeOf<number | undefined>();
  expectTypeOf(node.gap).toEqualTypeOf<number | undefined>();
  expectTypeOf(node.padding).toEqualTypeOf<FigmaPadding | undefined>();
  expectTypeOf(node.primaryAxisAlign).toEqualTypeOf<FigmaPrimaryAxisAlign | undefined>();
  expectTypeOf(node.counterAxisAlign).toEqualTypeOf<FigmaCounterAxisAlign | undefined>();
  expectTypeOf(node.layoutGrow).toEqualTypeOf<number | undefined>();
  expectTypeOf(padding.top).toEqualTypeOf<number>();
  expectTypeOf(padding.right).toEqualTypeOf<number>();
  expectTypeOf(padding.bottom).toEqualTypeOf<number>();
  expectTypeOf(padding.left).toEqualTypeOf<number>();
});

test('models structured paints, uniform and side-specific strokes, shadows, and corner radii', () => {
  const rgba: FigmaRgbaColor = { r: 0.067, g: 0.094, b: 0.153, a: 0.8 };
  const solidPaint: FigmaSolidPaint = { type: 'SOLID', color: rgba };
  const imagePaint: FigmaImagePaint = {
    type: 'IMAGE',
    src: 'https://example.com/hero.png',
    scaleMode: 'FILL',
  };
  const fills: FigmaFills = [solidPaint, imagePaint];
  const strokeSide: FigmaStrokeSide = 'TOP';
  const strokes: FigmaStrokes = [{ type: 'SOLID', color: rgba, side: strokeSide, weight: 2 }];
  const strokeWeights: FigmaStrokeWeights = { top: 2, right: 1, bottom: 3, left: 4 };
  const dropShadow: FigmaDropShadowEffect = {
    type: 'DROP_SHADOW',
    color: { r: 0, g: 0, b: 0, a: 0.25 },
    offset: { x: 0, y: 4 },
    radius: 8,
    spread: 1,
  };
  const innerShadow: FigmaInnerShadowEffect = {
    type: 'INNER_SHADOW',
    color: { r: 0, g: 0, b: 0, a: 0.25 },
    offset: { x: 0, y: 2 },
    radius: 4,
    spread: 0,
  };
  const node: FigmaNode = {
    id: 'node-3',
    tag: 'section',
    type: 'FRAME',
    rect: { x: 0, y: 0, width: 100, height: 100, top: 0, left: 0 },
    isVisible: true,
    fills,
    strokes,
    strokeWeight: 2,
    strokeWeights,
    effects: [dropShadow, innerShadow],
    cornerRadius: 8,
    cornerRadii: { topLeft: 8, topRight: 4, bottomRight: 2, bottomLeft: 0 },
    children: [],
  };

  expectTypeOf(rgba.r).toEqualTypeOf<number>();
  expectTypeOf(rgba.g).toEqualTypeOf<number>();
  expectTypeOf(rgba.b).toEqualTypeOf<number>();
  expectTypeOf(rgba.a).toEqualTypeOf<number>();
  expectTypeOf(solidPaint).toMatchTypeOf<FigmaPaint>();
  expectTypeOf(imagePaint).toEqualTypeOf<FigmaImagePaint>();
  expectTypeOf<FigmaFills>().toEqualTypeOf<FigmaPaint[]>();
  expectTypeOf<FigmaStrokes>().toEqualTypeOf<
    | { type: 'SOLID'; color: FigmaRgbaColor; side?: FigmaStrokeSide; weight: number }[]
    | null
  >();
  expectTypeOf(strokeSide).toMatchTypeOf<FigmaStrokeSide>();
  expectTypeOf(strokeWeights.top).toEqualTypeOf<number>();
  expectTypeOf(strokeWeights.right).toEqualTypeOf<number>();
  expectTypeOf(strokeWeights.bottom).toEqualTypeOf<number>();
  expectTypeOf(strokeWeights.left).toEqualTypeOf<number>();
  expectTypeOf(dropShadow).toMatchTypeOf<FigmaEffect>();
  expectTypeOf(innerShadow).toMatchTypeOf<FigmaEffect>();
  expectTypeOf(dropShadow.offset.x).toEqualTypeOf<number>();
  expectTypeOf(innerShadow.offset.y).toEqualTypeOf<number>();
  expectTypeOf(dropShadow.radius).toEqualTypeOf<number>();
  expectTypeOf(innerShadow.spread).toEqualTypeOf<number>();
  expectTypeOf(node.strokeWeight).toEqualTypeOf<number | undefined>();
  expectTypeOf(node.strokeWeights).toEqualTypeOf<FigmaStrokeWeights | undefined>();
  expectTypeOf(node.cornerRadius).toEqualTypeOf<number | undefined>();
  expectTypeOf(node.cornerRadii).toEqualTypeOf<
    | { topLeft: number; topRight: number; bottomRight: number; bottomLeft: number }
    | undefined
  >();
});

test('limits IMAGE paint scale modes to the four supported values', () => {
  const fill: FigmaImagePaint = {
    type: 'IMAGE',
    src: 'https://example.com/fill.png',
    scaleMode: 'FILL',
  };
  const fit: FigmaImagePaint = {
    type: 'IMAGE',
    src: 'https://example.com/fit.png',
    scaleMode: 'FIT',
  };
  const crop: FigmaImagePaint = {
    type: 'IMAGE',
    src: 'https://example.com/crop.png',
    scaleMode: 'CROP',
  };
  const tile: FigmaImagePaint = {
    type: 'IMAGE',
    src: 'https://example.com/tile.png',
    scaleMode: 'TILE',
  };

  expectTypeOf<FigmaImageScaleMode>().toEqualTypeOf<'FILL' | 'FIT' | 'CROP' | 'TILE'>();
  expectTypeOf(fill.scaleMode).toEqualTypeOf<FigmaImageScaleMode>();
  expectTypeOf(fit.scaleMode).toEqualTypeOf<FigmaImageScaleMode>();
  expectTypeOf(crop.scaleMode).toEqualTypeOf<FigmaImageScaleMode>();
  expectTypeOf(tile.scaleMode).toEqualTypeOf<FigmaImageScaleMode>();

  const unsupported: FigmaImagePaint = {
    type: 'IMAGE',
    src: 'https://example.com/unsupported.png',
    // @ts-expect-error Unsupported image paint scale modes must be rejected.
    scaleMode: 'STRETCH',
  };
  expectTypeOf(unsupported).toEqualTypeOf<FigmaImagePaint>();
});

test('models normalized TEXT runs, IMAGE paints, img metadata, inline SVG, and font assets', () => {
  const textAlign: FigmaTextAlign = 'CENTER';
  const textAutoResize: FigmaTextAutoResize = 'HEIGHT';
  const textStyles: FigmaTextStyle = {
    fontFamily: 'Inter',
    fontSize: 32,
    fontWeight: 700,
    lineHeight: 38.4,
    letterSpacing: 0,
    textAlign,
    textAutoResize,
  };
  const image = {
    src: 'https://example.com/hero.png',
    naturalWidth: 1600,
    naturalHeight: 900,
    objectFit: 'cover',
  } satisfies FigmaElementImageData;
  const asset: FigmaFontAsset = {
    family: 'Inter',
    weights: [400, 700],
    url: 'https://example.com/inter.woff2',
  };
  const textNode: FigmaNode = {
    id: 'node-4',
    tag: 'span',
    type: 'TEXT',
    rect: { x: 0, y: 0, width: 100, height: 40, top: 0, left: 0 },
    isVisible: true,
    characters: 'Welcome',
    styles: textStyles,
    children: [],
  };
  const imageNode: FigmaNode = {
    id: 'node-5',
    tag: 'img',
    type: 'IMAGE',
    rect: { x: 0, y: 0, width: 100, height: 40, top: 0, left: 0 },
    isVisible: true,
    fills: [{ type: 'IMAGE', src: image.src, scaleMode: 'FILL' }],
    image,
    children: [],
  };
  const backgroundFrame: FigmaNode = {
    id: 'node-6',
    tag: 'section',
    type: 'FRAME',
    rect: { x: 0, y: 40, width: 100, height: 40, top: 40, left: 0 },
    isVisible: true,
    fills: [{ type: 'IMAGE', src: 'https://example.com/background.png', scaleMode: 'FILL' }],
    children: [],
  };
  const svgNode: FigmaNode = {
    id: 'node-7',
    tag: 'svg',
    type: 'FRAME',
    rect: { x: 0, y: 80, width: 100, height: 40, top: 80, left: 0 },
    isVisible: true,
    svg: '<svg viewBox="0 0 1 1"></svg>',
    children: [],
  };

  expectTypeOf(textNode.characters).toEqualTypeOf<string | undefined>();
  expectTypeOf(textNode.styles).toEqualTypeOf<FigmaTextStyle | undefined>();
  expectTypeOf(textStyles.fontSize).toEqualTypeOf<number>();
  expectTypeOf(textStyles.fontWeight).toEqualTypeOf<number>();
  expectTypeOf(textStyles.lineHeight).toEqualTypeOf<number>();
  expectTypeOf(textStyles.letterSpacing).toEqualTypeOf<number>();
  expectTypeOf(textStyles.textAlign).toEqualTypeOf<FigmaTextAlign>();
  expectTypeOf(textStyles.textAutoResize).toEqualTypeOf<FigmaTextAutoResize>();
  expectTypeOf(imageNode.image).toEqualTypeOf<FigmaElementImageData | undefined>();
  expectTypeOf(imageNode.fills).toEqualTypeOf<FigmaFills | undefined>();
  expectTypeOf(backgroundFrame.fills).toEqualTypeOf<FigmaFills | undefined>();
  expectTypeOf(image.naturalWidth).toEqualTypeOf<number>();
  expectTypeOf(image.naturalHeight).toEqualTypeOf<number>();
  expectTypeOf(svgNode.svg).toEqualTypeOf<string | undefined>();
  expectTypeOf(asset.weights).toEqualTypeOf<number[]>();
  expectTypeOf(asset.url).toEqualTypeOf<string | undefined>();
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
    schemaVersion: '1.1',
    source: {
      url: 'https://example.com/',
      viewport,
    },
    styles,
    assets: [],
    document: node,
  };

  expectTypeOf(document.schemaVersion).toEqualTypeOf<'1.1'>();
  expectTypeOf(document.source.viewport).toEqualTypeOf<Viewport>();
  expectTypeOf(document.styles.colors).toEqualTypeOf<ColorStyle[]>();
  expectTypeOf(document.styles.typographies).toEqualTypeOf<TypographyStyle[]>();
  expectTypeOf(document.assets).toEqualTypeOf<FigmaFontAsset[]>();
  expectTypeOf(document.document.type).toEqualTypeOf<FigmaNodeType>();
  expectTypeOf(document.document.id).toEqualTypeOf<string>();
  expectTypeOf(document.document.tag).toEqualTypeOf<string>();
  expectTypeOf(document.document.rect).toEqualTypeOf<FigmaRect>();
});
