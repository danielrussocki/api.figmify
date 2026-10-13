import type { DirectTextRun, ExtractionDocument, ExtractionNode } from '../contracts/extraction/extraction-document.js';
import type {
  FigmaDocument,
  FigmaLayoutMode,
  FigmaNode,
  FigmaNodeType,
  FigmaPosition,
  FigmaRect,
  FigmaTextAlign,
  FigmaTextStyle,
} from '../contracts/figma/figma-document.js';
import {
  createColorStyleCatalog,
  createTypographyStyleCatalog,
} from './style-catalog.js';
import { parseFigmaPaints } from './paint-parser.js';
import { collectUsedFontAssets } from './font-assets.js';

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
export interface TransformExtractionNodeOptions {
  includeHidden?: boolean;
}

export function transformExtractionNode(
  node: ExtractionNode,
  options: TransformExtractionNodeOptions = {},
): FigmaNode {
  return mapExtractionNode(node, undefined, true, true, options.includeHidden ?? true);
}

function mapExtractionNode(
  node: ExtractionNode,
  parentContentOrigin: ContentOrigin | undefined,
  parentIsVisible: boolean,
  isRoot: boolean,
  includeHidden: boolean,
): FigmaNode {
  const rect = toFigmaRect(node.layout?.rect);
  const isVisible = parentIsVisible && determineVisibility(node, rect, isRoot);
  const type = determineFigmaNodeType(node);
  const textStyle = type === 'TEXT' ? normalizeTextStyle(node.styles) : undefined;
  const autoLayout = determineAutoLayout(node.styles);
  const positioning = determinePositioning(node.styles);
  const paints = parseFigmaPaints(node.styles);
  const image = imageData(node, type);
  const contentOrigin = getContentOrigin(rect, node.styles);
  const mapChild = (child: ExtractionNode): FigmaNode | undefined => {
    if (isExcludedFigmaTag(child.tagName)) {
      return undefined;
    }

    if (!includeHidden && !isVisible) {
      return undefined;
    }

    const childRect = toFigmaRect(child.layout?.rect);
    const childIsVisible = isVisible && determineVisibility(child, childRect, false);
    if (!includeHidden && !childIsVisible) {
      return undefined;
    }

    return mapExtractionNode(
      child,
      contentOrigin,
      isVisible,
      false,
      includeHidden,
    );
  };
  const children = mapChildrenAndDirectTextRuns(node, mapChild, rect, contentOrigin, isVisible, includeHidden);

  return {
    id: node.id,
    tag: node.tagName,
    type,
    rect,
    ...(parentContentOrigin === undefined
      ? {}
      : { relativeRect: toRelativeRect(rect, parentContentOrigin) }),
    isVisible,
    ...(autoLayout.layoutMode === undefined ? {} : { layoutMode: autoLayout.layoutMode }),
    ...(autoLayout.gap === undefined ? {} : { gap: autoLayout.gap }),
    ...(positioning.position === undefined ? {} : { position: positioning.position }),
    ...(positioning.zIndex === undefined ? {} : { zIndex: positioning.zIndex }),
    ...(paints.fills === null ? {} : { fills: paints.fills }),
    ...(paints.strokes === null ? {} : { strokes: paints.strokes }),
    ...(paints.effects === null ? {} : { effects: paints.effects }),
    ...(paints.cornerRadius === undefined ? {} : { cornerRadius: paints.cornerRadius }),
    ...(paints.cornerRadii === undefined ? {} : { cornerRadii: paints.cornerRadii }),
    ...(image === undefined ? {} : { image }),
    ...(node.tagName.toLowerCase() === 'svg' ? { svg: serializeInlineSvg(node) } : {}),
    ...(type === 'TEXT' ? { characters: node.text as string } : {}),
    ...(textStyle === undefined ? {} : { styles: textStyle }),
    children,
  };
}

/**
 * Rebuilds direct text placement among element children from their retained
 * child-node indexes. Shadow children remain after the light-DOM sequence.
 */
function mapChildrenAndDirectTextRuns(
  node: ExtractionNode,
  mapChild: (child: ExtractionNode) => FigmaNode | undefined,
  parentRect: FigmaRect,
  parentContentOrigin: ContentOrigin,
  isVisible: boolean,
  includeHidden: boolean,
): FigmaNode[] {
  const children: FigmaNode[] = [];
  const directTextRuns = [...(node.directTextRuns ?? [])]
    .sort((left, right) => left.childNodeIndex - right.childNodeIndex);
  let childIndex = 0;

  for (const [textRunIndex, textRun] of directTextRuns.entries()) {
    const elementCountBeforeRun = Math.max(0, Math.min(
      node.children.length,
      textRun.childNodeIndex - textRunIndex,
    ));
    while (childIndex < elementCountBeforeRun) {
      const child = mapChild(node.children[childIndex++]);
      if (child !== undefined) children.push(child);
    }

    if (includeHidden || isVisible) {
      children.push(mapDirectTextRun(node, textRun, parentRect, parentContentOrigin, isVisible));
    }
  }

  for (; childIndex < node.children.length; childIndex += 1) {
    const child = mapChild(node.children[childIndex]);
    if (child !== undefined) children.push(child);
  }

  for (const shadowChild of node.shadowChildren ?? []) {
    const child = mapChild(shadowChild);
    if (child !== undefined) children.push(child);
  }

  return children;
}

function mapDirectTextRun(
  parent: ExtractionNode,
  textRun: DirectTextRun,
  parentRect: FigmaRect,
  parentContentOrigin: ContentOrigin,
  isVisible: boolean,
): FigmaNode {
  const paints = parseFigmaPaints(textRun.styles);
  const textStyle = normalizeTextStyle(textRun.styles);

  return {
    id: `${parent.id}-text-${textRun.childNodeIndex}`,
    tag: '#text',
    type: 'TEXT',
    rect: parentRect,
    relativeRect: toRelativeRect(parentRect, parentContentOrigin),
    isVisible,
    ...(paints.fills === null ? {} : { fills: paints.fills }),
    ...(paints.strokes === null ? {} : { strokes: paints.strokes }),
    ...(paints.effects === null ? {} : { effects: paints.effects }),
    characters: textRun.characters,
    ...(textStyle === undefined ? {} : { styles: textStyle }),
    children: [],
  };
}

function imageData(node: ExtractionNode, type: FigmaNodeType): FigmaNode['image'] | undefined {
  if (type !== 'IMAGE' || node.tagName.toLowerCase() !== 'img') return undefined;

  const src = node.resources.find((resource) => resource.kind === 'image')?.url;
  const { naturalWidth, naturalHeight, objectFit } = node.layout ?? {};
  if (src === undefined
    || !isNaturalDimension(naturalWidth)
    || !isNaturalDimension(naturalHeight)
    || objectFit === undefined) {
    return undefined;
  }

  return { src, naturalWidth, naturalHeight, objectFit };
}

function isNaturalDimension(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value >= 0;
}

/** Reconstructs the retained inline SVG tree without treating it as an asset. */
function serializeInlineSvg(node: ExtractionNode): string {
  const attributes = Object.entries(node.attributes)
    .map(([name, value]) => ` ${name}="${escapeSvgValue(value)}"`)
    .join('');
  const children = node.children.map(serializeInlineSvg).join('');
  const text = node.children.length === 0 && node.text !== null ? escapeSvgText(node.text) : '';

  return `<${node.tagName}${attributes}>${text}${children}</${node.tagName}>`;
}

function escapeSvgValue(value: string): string {
  return value.replace(/&/gu, '&amp;').replace(/"/gu, '&quot;').replace(/</gu, '&lt;');
}

function escapeSvgText(value: string): string {
  return value.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;');
}

function determineAutoLayout(styles: Record<string, string>): {
  layoutMode?: FigmaLayoutMode;
  gap?: number;
} {
  const display = styles.display?.trim().toLowerCase();
  if (display !== 'flex' && display !== 'inline-flex' && display !== 'grid' && display !== 'inline-grid') {
    return {};
  }

  const flexDirection = styles['flex-direction']?.trim().toLowerCase();
  const layoutMode: FigmaLayoutMode = (display === 'flex' || display === 'inline-flex')
    && (flexDirection === 'column' || flexDirection === 'column-reverse')
    ? 'VERTICAL'
    : 'HORIZONTAL';
  const gap = cssNumber(styles.gap);

  return {
    layoutMode,
    ...(gap === undefined || gap === 0 ? {} : { gap }),
  };
}

function determinePositioning(styles: Record<string, string>): {
  position?: FigmaPosition;
  zIndex?: number;
} {
  const position = styles.position?.trim().toLowerCase();
  if (position !== 'absolute' && position !== 'sticky') return {};

  const zIndex = cssInteger(styles['z-index']);
  return {
    position,
    ...(zIndex === undefined ? {} : { zIndex }),
  };
}

/** Converts the computed CSS typography of a text run to the Figma contract. */
function normalizeTextStyle(styles: Record<string, string>): FigmaTextStyle | undefined {
  const fontFamily = primaryFontFamily(styles['font-family']);
  const fontSize = cssNumber(styles['font-size']);
  const fontWeight = fontWeightNumber(styles['font-weight']);

  if (fontFamily === undefined || fontSize === undefined || fontWeight === undefined) {
    return undefined;
  }

  const lineHeight = styles['line-height']?.trim().toLowerCase() === 'normal'
    ? fontSize * 1.2
    : cssNumber(styles['line-height']);
  const letterSpacing = styles['letter-spacing']?.trim().toLowerCase() === 'normal'
    ? 0
    : cssNumber(styles['letter-spacing']);

  if (lineHeight === undefined || letterSpacing === undefined) {
    return undefined;
  }

  return {
    fontFamily,
    fontSize,
    fontWeight,
    lineHeight,
    letterSpacing,
    textAlign: normalizeTextAlign(styles['text-align']),
    textAutoResize: styles['white-space']?.trim().toLowerCase() === 'nowrap'
      ? 'WIDTH_AND_HEIGHT'
      : 'HEIGHT',
  };
}

function primaryFontFamily(value: string | undefined): string | undefined {
  const family = value?.split(',', 1)[0]?.trim().replace(/^(?:"([^"]*)"|'([^']*)')$/u, '$1$2');
  return family === undefined || family.length === 0 ? undefined : family;
}

function cssNumber(value: string | undefined): number | undefined {
  const match = /^(-?(?:\d+\.?\d*|\.\d+))(?:px)?$/iu.exec(value?.trim() ?? '');
  if (match?.[1] === undefined) return undefined;

  const number = Number(match[1]);
  return Number.isFinite(number) ? number : undefined;
}

function cssInteger(value: string | undefined): number | undefined {
  const normalized = value?.trim();
  if (normalized === undefined || !/^-?\d+$/u.test(normalized)) return undefined;

  const number = Number(normalized);
  return Number.isSafeInteger(number) ? number : undefined;
}

function fontWeightNumber(value: string | undefined): number | undefined {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'normal') return 400;
  if (normalized === 'bold') return 700;
  return cssNumber(normalized);
}

function normalizeTextAlign(value: string | undefined): FigmaTextAlign {
  switch (value?.trim().toLowerCase()) {
    case 'center': return 'CENTER';
    case 'right':
    case 'end': return 'RIGHT';
    case 'justify': return 'JUSTIFIED';
    default: return 'LEFT';
  }
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
    && node.tagName.toLowerCase() !== 'body'
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
export function transformExtractionDocument(
  extraction: ExtractionDocument,
  options: TransformExtractionNodeOptions = {},
): FigmaDocument {
  const document = transformExtractionNode(extraction.document, options);
  const referencedNodeIds = collectReferencedCatalogNodeIds(document);
  const colors = createColorStyleCatalog(extraction.document, referencedNodeIds.colors);
  const typographies = createTypographyStyleCatalog(extraction.document, referencedNodeIds.typographies);
  return {
    schemaVersion: '1.0',
    source: {
      url: extraction.source.url,
      viewport: { ...extraction.source.viewport },
    },
    styles: { colors, typographies },
    assets: collectUsedFontAssets(document),
    document,
  };
}

/** Collects only resources represented by visible nodes retained in the Figma tree. */
function collectReferencedCatalogNodeIds(document: FigmaNode): {
  colors: ReadonlySet<string>;
  typographies: ReadonlySet<string>;
} {
  const colors = new Set<string>();
  const typographies = new Set<string>();

  const visit = (node: FigmaNode): void => {
    if (node.isVisible) {
      colors.add(node.id);
      if (node.type === 'TEXT') {
        typographies.add(node.id);
      }
    }

    for (const child of node.children) {
      visit(child);
    }
  };

  visit(document);
  return { colors, typographies };
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
    .some((match) => match[2]?.trim().length !== 0);
}

function isPureTextLeaf(node: ExtractionNode): boolean {
  return node.text !== null
    && node.text.trim().length > 0
    && node.children.length === 0
    && (node.shadowChildren?.length ?? 0) === 0;
}
