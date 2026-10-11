import type { ExtractionNode } from '../contracts/extraction/extraction-document.js';
import type { FigmaNode, FigmaNodeType } from '../contracts/figma/figma-document.js';

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
