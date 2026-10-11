import type { ExtractionNode, PseudoElement } from '../contracts/extraction/extraction-document.js';
import { VISUAL_PROPERTIES } from './visual-properties.js';

const ALLOWED_ATTRIBUTE_NAMES = [
  'id',
  'class',
  'role',
  'title',
  'lang',
  'dir',
  'hidden',
  'tabindex',
  'alt',
  'aria-label',
  'aria-labelledby',
  'aria-describedby',
  'aria-hidden',
  'href',
  'target',
  'src',
  'srcset',
  'poster',
  'width',
  'height',
  'type',
  'value',
  'placeholder',
  'checked',
  'selected',
  'disabled',
  'name',
  'viewBox',
] as const;

const ALLOWED_ATTRIBUTES = new Map<string, string>(
  ALLOWED_ATTRIBUTE_NAMES.map((name) => [name.toLowerCase(), name]),
);

/**
 * Serializes an element subtree with the fields that are independent of later
 * extraction concerns such as styles, attributes, and resources.
 */
export function serializeElement(element: Element): ExtractionNode {
  let nextId = 1;

  const serialize = (currentElement: Element): ExtractionNode => ({
    id: `node-${nextId++}`,
    tagName: currentElement.tagName.toLowerCase(),
    attributes: selectAllowedAttributes(currentElement),
    resources: resolveResourceReferences(currentElement),
    text: readRenderedText(currentElement),
    styles: readVisualStyles(currentElement),
    pseudoElements: {
      before: readPseudoElement(currentElement, '::before'),
      after: readPseudoElement(currentElement, '::after'),
    },
    children: Array.from(currentElement.children, serialize),
  });

  return serialize(element);
}

function selectAllowedAttributes(element: Element): Record<string, string> {
  const attributes: Record<string, string> = {};

  if (typeof element.getAttributeNames !== 'function') {
    return attributes;
  }

  for (const attributeName of element.getAttributeNames()) {
    const outputName = ALLOWED_ATTRIBUTES.get(attributeName.toLowerCase());

    if (outputName === undefined) {
      continue;
    }

    const value = readAttribute(element, attributeName);

    if (value !== null) {
      attributes[outputName] = value;
    }
  }

  return attributes;
}

function resolveResourceReferences(element: Element): ExtractionNode['resources'] {
  const tagName = element.tagName.toLowerCase();
  const resources: ExtractionNode['resources'] = [];
  const addResource = (kind: ExtractionNode['resources'][number]['kind'], reference: string | null) => {
    const url = resolveResourceUrl(element, reference);

    if (url !== null) {
      resources.push({ kind, url });
    }
  };

  if (tagName === 'img' || (tagName === 'input' && readAttribute(element, 'type')?.toLowerCase() === 'image')) {
    addResource('image', readAttribute(element, 'src'));
  }

  if (tagName === 'img' || tagName === 'source') {
    for (const candidate of parseSrcset(readAttribute(element, 'srcset'))) {
      addResource('image', candidate);
    }
  }

  if (tagName === 'video') {
    addResource('media', readAttribute(element, 'poster'));
    addResource('media', readAttribute(element, 'src'));
  }

  if (tagName === 'audio' || tagName === 'source') {
    addResource('media', readAttribute(element, 'src'));
  }

  if (tagName === 'link' && hasStylesheetRelationship(readAttribute(element, 'rel'))) {
    addResource('stylesheet', readAttribute(element, 'href'));
  }

  return resources;
}

function readAttribute(element: Element, name: string): string | null {
  return typeof element.getAttribute === 'function' ? element.getAttribute(name) : null;
}

function parseSrcset(srcset: string | null): string[] {
  if (srcset === null) {
    return [];
  }

  return srcset
    .split(',')
    .map((candidate) => candidate.trim().split(/\s+/, 1)[0])
    .filter((candidate): candidate is string => candidate !== undefined && candidate.length > 0);
}

function hasStylesheetRelationship(rel: string | null): boolean {
  return rel?.split(/\s+/).some((value) => value.toLowerCase() === 'stylesheet') ?? false;
}

function resolveResourceUrl(element: Element, reference: string | null): string | null {
  if (reference === null || reference.trim().length === 0) {
    return null;
  }

  try {
    return new URL(reference, element.baseURI).href;
  } catch {
    return null;
  }
}

function readVisualStyles(element: Element): Record<string, string> {
  const view = element.ownerDocument?.defaultView;

  if (view === null || view === undefined) {
    return {};
  }

  let computedStyles: CSSStyleDeclaration;
  try {
    computedStyles = view.getComputedStyle(element);
  } catch {
    return {};
  }

  return selectVisualStyles(computedStyles);
}

function readPseudoElement(element: Element, pseudoElement: '::before' | '::after'): PseudoElement | null {
  const view = element.ownerDocument?.defaultView;

  if (view === null || view === undefined) {
    return null;
  }

  let computedStyles: CSSStyleDeclaration;
  try {
    computedStyles = view.getComputedStyle(element, pseudoElement);
  } catch {
    return null;
  }

  const content = readPseudoContent(computedStyles);

  if (content === null) {
    return null;
  }

  return {
    content,
    styles: selectVisualStyles(computedStyles),
  };
}

function readPseudoContent(computedStyles: CSSStyleDeclaration): string | null {
  let value: unknown;
  try {
    value = computedStyles.getPropertyValue('content');
  } catch {
    return null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const content = value.trim();

  if (content.length === 0 || content === 'none' || content === 'normal') {
    return null;
  }

  if ((content.startsWith('"') && content.endsWith('"')) || (content.startsWith("'") && content.endsWith("'"))) {
    return content.slice(1, -1).replace(/\\([\\"'])/g, '$1');
  }

  return content;
}

function selectVisualStyles(computedStyles: CSSStyleDeclaration): Record<string, string> {
  const styles: Record<string, string> = {};

  for (const property of VISUAL_PROPERTIES) {
    try {
      const value: unknown = computedStyles.getPropertyValue(property);

      if (typeof value === 'string' && value.trim().length > 0) {
        styles[property] = value;
      }
    } catch {
      // Omit computed values that cannot be determined or serialized.
    }
  }

  return styles;
}

function readRenderedText(element: Element): string | null {
  if (!isRendered(element)) {
    return null;
  }

  const text = (element as HTMLElement).innerText;

  return typeof text === 'string' && text.trim().length > 0 ? text : null;
}

function isRendered(element: Element): boolean {
  let current: Element | null = element;

  while (current !== null) {
    if (current.hasAttribute('hidden')) {
      return false;
    }

    const styles = current.ownerDocument?.defaultView?.getComputedStyle(current);

    if (styles?.display === 'none') {
      return false;
    }

    if (current === element && (styles?.visibility === 'hidden' || styles?.visibility === 'collapse')) {
      return false;
    }

    current = current.parentElement ?? null;
  }

  return true;
}
