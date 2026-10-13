import type { ExtractionDocument, ExtractionNode } from '../contracts/extraction/extraction-document.js';
import type { FigmaDocument, FigmaNode, FigmaNodeType, FigmaRect } from '../contracts/figma/figma-document.js';
import {
  createColorStyleCatalog,
  createTypographyStyleCatalog,
} from './style-catalog.js';

const EMPTY_RECT = { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0 };
const EXCLUDED_FIGMA_TAGS = new Set([
  'head',
  'meta',
  'title',
  'script',
  'link',
  'style',
  'base',
  'template',
  'noscript',
]);

/**
 * Converts an extracted node tree into the Figma-oriented node contract.
 * Reusable style catalog references are assigned when the full document is
 * assembled; this conversion intentionally preserves raw computed styles.
 */
export function transformExtractionNode(node: ExtractionNode): FigmaNode {
  return mapExtractionNode(node);
}

function mapExtractionNode(node: ExtractionNode, parentContentOrigin?: ContentOrigin): FigmaNode {
  const rect = toFigmaRect(node.layout?.rect);
  const children = [...node.children, ...(node.shadowChildren ?? [])].flatMap((child) => {
    if (isExcludedFigmaTag(child.tagName)) {
      return [];
    }

    return [mapExtractionNode(child, getContentOrigin(rect, node.styles))];
  });

  return {
    id: node.id,
    tag: node.tagName,
    type: determineFigmaNodeType(node),
    rect,
    ...(parentContentOrigin === undefined
      ? {}
      : { relativeRect: toRelativeRect(rect, parentContentOrigin) }),
    isVisible: determineVisibility(node, rect, parentContentOrigin === undefined),
    children,
  };
}

/**
 * Determines whether the browser measurements describe a renderable node.
 * `offsetParent` is only a visibility signal for regular descendants: browser
 * roots, SVG roots, and fixed-position boxes intentionally have no offset
 * parent while remaining visible.
 */
function determineVisibility(node: ExtractionNode, rect: FigmaRect, isRoot: boolean): boolean {
  if (normalizedStyle(node, 'display') === 'none') return false;
  if (normalizedStyle(node, 'visibility') === 'hidden' || normalizedStyle(node, 'visibility') === 'collapse') return false;
  if ('hidden' in node.attributes) return false;

  const opacity = Number.parseFloat(node.styles.opacity ?? '1');
  if (Number.isFinite(opacity) && opacity <= 0) return false;
  if (node.layout !== undefined && (rect.width <= 0 || rect.height <= 0)) return false;

  if (node.layout?.hasOffsetParent === false
    && !isRoot
    && node.tagName.toLowerCase() !== 'svg'
    && normalizedStyle(node, 'position') !== 'fixed') {
    return false;
  }

  return true;
}

function normalizedStyle(node: ExtractionNode, property: string): string | undefined {
  const value = node.styles[property];
  return value?.trim().toLowerCase();
}

interface ContentOrigin {
  x: number;
  y: number;
}

function toFigmaRect(rect: FigmaRect | undefined): FigmaRect {
  const source = rect ?? EMPTY_RECT;
  return {
    x: finiteNumber(source.x),
    y: finiteNumber(source.y),
    width: finiteNumber(source.width),
    height: finiteNumber(source.height),
    top: finiteNumber(source.top),
    left: finiteNumber(source.left),
  };
}

function toRelativeRect(rect: FigmaRect, parentContentOrigin: ContentOrigin): FigmaRect {
  return {
    x: finiteNumber(rect.x - parentContentOrigin.x),
    y: finiteNumber(rect.y - parentContentOrigin.y),
    width: rect.width,
    height: rect.height,
    top: finiteNumber(rect.top - parentContentOrigin.y),
    left: finiteNumber(rect.left - parentContentOrigin.x),
  };
}

function getContentOrigin(rect: FigmaRect, styles: Record<string, string>): ContentOrigin {
  return {
    x: finiteNumber(rect.x + cssPixelValue(styles['border-left-width']) + cssPixelValue(styles['padding-left'])),
    y: finiteNumber(rect.y + cssPixelValue(styles['border-top-width']) + cssPixelValue(styles['padding-top'])),
  };
}

function cssPixelValue(value: string | undefined): number {
  if (value === undefined) return 0;

  const match = /^(-?(?:\d+\.?\d*|\.\d+))px$/i.exec(value.trim());
  return match === null ? 0 : finiteNumber(Number(match[1]));
}

function finiteNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function isExcludedFigmaTag(tagName: string): boolean {
  return EXCLUDED_FIGMA_TAGS.has(tagName.toLowerCase());
}

/** Converts a complete extraction document into the versioned Figma contract. */
export function transformExtractionDocument(extraction: ExtractionDocument): FigmaDocument {
  const colors = createColorStyleCatalog(extraction.document);
  const typographies = createTypographyStyleCatalog(extraction.document);
  return {
    schemaVersion: '1.0',
    source: {
      url: extraction.source.url,
      viewport: { ...extraction.source.viewport },
    },
    styles: { colors, typographies },
    assets: [],
    document: transformExtractionNode(extraction.document),
  };
}

function determineFigmaNodeType(node: ExtractionNode): FigmaNodeType {
  const tagName = node.tagName.toLowerCase();

  if (tagName === 'img' || hasRenderableBackgroundImage(node)) {
    return 'IMAGE';
  }

  if (isPureTextLeaf(node)) {
    return 'TEXT';
  }

  return 'FRAME';
}

function hasRenderableBackgroundImage(node: ExtractionNode): boolean {
  const backgroundImage = node.styles['background-image'];
  if (backgroundImage === undefined) return false;

  return [...backgroundImage.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)]
    .some((match) => match[2].trim().length > 0);
}

function isPureTextLeaf(node: ExtractionNode): boolean {
  return node.text !== null
    && node.text.trim().length > 0
    && node.children.length === 0
    && (node.shadowChildren?.length ?? 0) === 0;
}
