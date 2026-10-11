import type { ExtractionDocument, ExtractionNode } from '../contracts/extraction/extraction-document.js';
import type { FigmaDocument, FigmaNode, FigmaNodeType } from '../contracts/figma/figma-document.js';
import {
  createColorStyleCatalog,
  createTypographyStyleCatalog,
  findColorStyleForNode,
  findTypographyStyleForNode,
} from './style-catalog.js';

const VECTOR_TAG_NAMES = new Set([
  'svg',
  'path',
  'circle',
  'ellipse',
  'line',
  'polygon',
  'polyline',
  'rect',
]);

/**
 * Converts an extracted node tree into the Figma-oriented node contract.
 * Reusable style catalog references are assigned when the full document is
 * assembled; this conversion intentionally preserves raw computed styles.
 */
export function transformExtractionNode(node: ExtractionNode): FigmaNode {
  const children = [...node.children, ...(node.shadowChildren ?? [])].map(transformExtractionNode);

  return {
    sourceId: node.id,
    type: determineFigmaNodeType(node),
    name: node.tagName,
    ...(node.text === null ? {} : { characters: node.text }),
    attributes: { ...node.attributes },
    resources: node.resources.map((resource) => ({ ...resource })),
    styles: transformStyles(node.styles),
    children,
  };
}

/** Converts a complete extraction document into the versioned Figma contract. */
export function transformExtractionDocument(extraction: ExtractionDocument): FigmaDocument {
  const colors = createColorStyleCatalog(extraction.document);
  const typographies = createTypographyStyleCatalog(extraction.document);
  const colorIds = new Set(colors.map((style) => style.id));
  const typographyIds = new Set(typographies.map((style) => style.id));

  return {
    schemaVersion: '1.0',
    source: {
      url: extraction.source.url,
      viewport: { ...extraction.source.viewport },
    },
    styles: { colors, typographies },
    document: transformNodeWithStyleReferences(extraction.document, colorIds, typographyIds),
  };
}

function transformNodeWithStyleReferences(
  node: ExtractionNode,
  colorIds: ReadonlySet<string>,
  typographyIds: ReadonlySet<string>,
): FigmaNode {
  const colorStyle = findColorStyleForNode(node.styles);
  const typographyStyle = findTypographyStyleForNode(node.styles);

  return {
    ...transformExtractionNode({ ...node, children: [], shadowChildren: [] }),
    ...(colorStyle !== null && colorIds.has(colorStyle.id) ? { fillStyleId: colorStyle.id } : {}),
    ...(typographyStyle !== null && typographyIds.has(typographyStyle.id)
      ? { textStyleId: typographyStyle.id }
      : {}),
    children: [...node.children, ...(node.shadowChildren ?? [])].map((child) =>
      transformNodeWithStyleReferences(child, colorIds, typographyIds),
    ),
  };
}

function determineFigmaNodeType(node: ExtractionNode): FigmaNodeType {
  const tagName = node.tagName.toLowerCase();

  if (tagName === 'html') {
    return 'DOCUMENT';
  }

  if (VECTOR_TAG_NAMES.has(tagName)) {
    return 'VECTOR';
  }

  if (tagName === 'img' || node.resources.some((resource) => resource.kind === 'image')) {
    return 'IMAGE';
  }

  if (node.text !== null) {
    return 'TEXT';
  }

  return 'FRAME';
}

function transformStyles(styles: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(styles).map(([property, value]) => [toCamelCase(property), value]),
  );
}

function toCamelCase(property: string): string {
  return property.replace(/-([a-z])/gu, (_, character: string) => character.toUpperCase());
}
