import { describe, expect, test } from 'vitest';

import type { ExtractionNode } from '../../../src/contracts/extraction/extraction-document.js';
import type { FigmaNodeType } from '../../../src/contracts/figma/figma-document.js';
import { transformExtractionNode } from '../../../src/figma/transformer.js';

function node(overrides: Partial<ExtractionNode> = {}): ExtractionNode {
  return {
    id: 'node-1',
    tagName: 'div',
    attributes: {},
    resources: [],
    text: null,
    styles: {},
    pseudoElements: { before: null, after: null },
    children: [],
    ...overrides,
  };
}

describe('transformExtractionNode', () => {
  test('preserves source information, text, attributes, resources, and nested structure', () => {
    const resource = { kind: 'image' as const, url: 'https://example.com/logo.png' };
    const extraction = node({
      id: 'node-root',
      tagName: 'section',
      attributes: { class: 'hero', 'aria-label': 'Hero' },
      resources: [resource],
      styles: { 'background-color': 'rgb(255, 255, 255)', 'font-size': '16px' },
      children: [node({ id: 'node-heading', tagName: 'h1', text: 'Welcome' })],
      shadowChildren: [node({ id: 'node-shadow', tagName: 'span', text: 'From shadow DOM' })],
    });

    expect(transformExtractionNode(extraction)).toEqual({
      sourceId: 'node-root',
      type: 'IMAGE',
      name: 'section',
      attributes: { class: 'hero', 'aria-label': 'Hero' },
      resources: [resource],
      styles: { backgroundColor: 'rgb(255, 255, 255)', fontSize: '16px' },
      children: [
        {
          sourceId: 'node-heading',
          type: 'TEXT',
          name: 'h1',
          characters: 'Welcome',
          attributes: {},
          resources: [],
          styles: {},
          children: [],
        },
        {
          sourceId: 'node-shadow',
          type: 'TEXT',
          name: 'span',
          characters: 'From shadow DOM',
          attributes: {},
          resources: [],
          styles: {},
          children: [],
        },
      ],
    });
  });

  test.each([
    ['html', null, 'DOCUMENT'],
    ['svg', null, 'VECTOR'],
    ['img', null, 'IMAGE'],
    ['div', 'Visible text', 'TEXT'],
    ['div', null, 'FRAME'],
  ] as [string, string | null, FigmaNodeType][])('maps %s nodes to the permitted node type', (tagName, text, type) => {
    expect(transformExtractionNode(node({ tagName, text }))).toMatchObject({ type });
  });
});
