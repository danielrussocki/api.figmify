import type { ExtractionNode } from '../contracts/extraction/extraction-document.js';

/**
 * Serializes an element subtree with the fields that are independent of later
 * extraction concerns such as text, styles, attributes, and resources.
 */
export function serializeElement(element: Element): ExtractionNode {
  let nextId = 1;

  const serialize = (currentElement: Element): ExtractionNode => ({
    id: `node-${nextId++}`,
    tagName: currentElement.tagName.toLowerCase(),
    attributes: {},
    resources: [],
    text: null,
    styles: {},
    pseudoElements: {
      before: null,
      after: null,
    },
    children: Array.from(currentElement.children, serialize),
  });

  return serialize(element);
}
