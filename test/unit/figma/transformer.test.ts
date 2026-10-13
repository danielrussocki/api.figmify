import { describe, expect, test } from 'vitest';

import type { ExtractionDocument, ExtractionNode } from '../../../src/contracts/extraction/extraction-document.js';
import type { FigmaNodeType } from '../../../src/contracts/figma/figma-document.js';
import { transformExtractionDocument, transformExtractionNode } from '../../../src/figma/transformer.js';

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
  test('excludes non-renderable and metadata tags from the Figma tree', () => {
    const excludedTags = ['head', 'meta', 'title', 'script', 'link', 'style', 'base', 'template', 'noscript'];
    const extraction = node({
      id: 'node-root',
      tagName: 'html',
      children: [
        node({
          id: 'node-body',
          tagName: 'body',
          children: [
            ...excludedTags.map((tagName, index) => node({
              id: `node-excluded-${index}`,
              tagName,
              text: 'Metadata',
            })),
            node({ id: 'node-visible', tagName: 'main' }),
          ],
          shadowChildren: [node({ id: 'node-shadow-style', tagName: 'style' })],
        }),
      ],
    });

    expect(transformExtractionNode(extraction)).toMatchObject({
      tag: 'html',
      children: [
        {
          tag: 'body',
          children: [{ id: 'node-visible', tag: 'main' }],
        },
      ],
    });
  });

  test('maps the extraction tree to compact nodes with geometry and visibility', () => {
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
      id: 'node-root',
      tag: 'section',
      type: 'IMAGE',
      rect: { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0 },
      isVisible: true,
      children: [
        {
          id: 'node-heading',
          tag: 'h1',
          type: 'TEXT',
          rect: { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0 },
          isVisible: true,
          children: [],
        },
        {
          id: 'node-shadow',
          tag: 'span',
          type: 'TEXT',
          rect: { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0 },
          isVisible: true,
          children: [],
        },
      ],
    });
  });

  test.each([
    ['html', null, 'FRAME'],
    ['svg', null, 'FRAME'],
    ['img', null, 'IMAGE'],
    ['div', 'Visible text', 'TEXT'],
    ['div', null, 'FRAME'],
  ] as [string, string | null, FigmaNodeType][])('maps %s nodes to the permitted node type', (tagName, text, type) => {
    expect(transformExtractionNode(node({ tagName, text }))).toMatchObject({ type });
  });
});

describe('transformExtractionDocument', () => {
  test('creates a versioned Figma document with reusable style references throughout the tree', () => {
    const typography = {
      'font-family': 'Inter, sans-serif',
      'font-size': '32px',
      'font-weight': '700',
      'font-style': 'normal',
      'line-height': '38.4px',
      'letter-spacing': 'normal',
      'text-transform': 'none',
    };
    const extraction: ExtractionDocument = {
      schemaVersion: '1.0',
      source: {
        url: 'https://example.com/',
        viewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
        environment: {
          locale: 'en-US',
          timezone: 'UTC',
          colorScheme: 'light',
          reducedMotion: 'no-preference',
        },
      },
      document: node({
        id: 'node-root',
        tagName: 'html',
        styles: { 'background-color': 'rgb(255, 255, 255)' },
        children: [node({
          id: 'node-heading',
          tagName: 'h1',
          text: 'Welcome',
          styles: { color: 'rgb(17, 24, 39)', ...typography },
          shadowChildren: [node({
            id: 'node-shadow',
            tagName: 'span',
            text: 'From shadow DOM',
            styles: { color: '#111827', ...typography },
          })],
        })],
      }),
    };

    expect(transformExtractionDocument(extraction)).toMatchObject({
      schemaVersion: '1.0',
      source: {
        url: 'https://example.com/',
        viewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
      },
      styles: {
        colors: [
          {
            id: 'color-111827',
            name: '#111827',
            rgba: { r: 0.067, g: 0.094, b: 0.153, a: 1 },
          },
          {
            id: 'color-ffffff',
            name: '#ffffff',
            rgba: { r: 1, g: 1, b: 1, a: 1 },
          },
        ],
        typographies: [
          {
            id: 'type-inter-32-700-normal-38.4-0-none',
            fontFamily: 'Inter, sans-serif',
            fontSize: '32px',
            fontWeight: '700',
            fontStyle: 'normal',
            lineHeight: '38.4px',
            letterSpacing: 'normal',
            textTransform: 'none',
          },
        ],
      },
      document: {
        id: 'node-root',
        tag: 'html',
        type: 'FRAME',
        rect: { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0 },
        isVisible: true,
        children: [
          {
            id: 'node-heading',
            tag: 'h1',
            type: 'TEXT',
            rect: { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0 },
            isVisible: true,
            children: [
              {
                id: 'node-shadow',
                tag: 'span',
                type: 'TEXT',
                rect: { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0 },
                isVisible: true,
                children: [],
              },
            ],
          },
        ],
      },
    });
  });
});
