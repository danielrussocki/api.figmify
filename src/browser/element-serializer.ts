import type { ExtractionNode } from '../contracts/extraction/extraction-document.js';
import { VISUAL_PROPERTIES } from './visual-properties.js';

/**
 * Serializes an element subtree with the fields that are independent of later
 * extraction concerns such as styles, attributes, and resources.
 */
export function serializeElement(element: Element): ExtractionNode {
  let nextId = 1;

  const serialize = (currentElement: Element): ExtractionNode => ({
    id: `node-${nextId++}`,
    tagName: currentElement.tagName.toLowerCase(),
    attributes: {},
    resources: [],
    text: readRenderedText(currentElement),
    styles: readVisualStyles(currentElement),
    pseudoElements: {
      before: null,
      after: null,
    },
    children: Array.from(currentElement.children, serialize),
  });

  return serialize(element);
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
