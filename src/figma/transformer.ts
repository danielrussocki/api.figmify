import type { ExtractionDocument, ExtractionNode } from '../contracts/extraction/extraction-document.js';
import type { FigmaDocument, FigmaNode, FigmaNodeType } from '../contracts/figma/figma-document.js';
import {
  createColorStyleCatalog,
  createTypographyStyleCatalog,
} from './style-catalog.js';

const EMPTY_RECT = { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0 };

/**
 * Converts an extracted node tree into the Figma-oriented node contract.
 * Reusable style catalog references are assigned when the full document is
 * assembled; this conversion intentionally preserves raw computed styles.
 */
export function transformExtractionNode(node: ExtractionNode): FigmaNode {
  const children = [...node.children, ...(node.shadowChildren ?? [])].map(transformExtractionNode);

  return {
    id: node.id,
    tag: node.tagName,
    type: determineFigmaNodeType(node),
    rect: { ...(node.layout?.rect ?? EMPTY_RECT) },
    isVisible: true,
    children,
  };
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
    document: transformExtractionNode(extraction.document),
  };
}

function determineFigmaNodeType(node: ExtractionNode): FigmaNodeType {
  const tagName = node.tagName.toLowerCase();

  if (tagName === 'img' || node.resources.some((resource) => resource.kind === 'image')) {
    return 'IMAGE';
  }

  if (node.text !== null) {
    return 'TEXT';
  }

  return 'FRAME';
}
