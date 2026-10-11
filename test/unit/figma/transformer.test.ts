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

    expect(transformExtractionDocument(extraction)).toEqual({
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
        sourceId: 'node-root',
        type: 'DOCUMENT',
        name: 'html',
        attributes: {},
        resources: [],
        styles: { backgroundColor: 'rgb(255, 255, 255)' },
        children: [
          {
            sourceId: 'node-heading',
            type: 'TEXT',
            name: 'h1',
            characters: 'Welcome',
            attributes: {},
            resources: [],
            fillStyleId: 'color-111827',
            textStyleId: 'type-inter-32-700-normal-38.4-0-none',
            styles: {
              color: 'rgb(17, 24, 39)',
              fontFamily: 'Inter, sans-serif',
              fontSize: '32px',
              fontWeight: '700',
              fontStyle: 'normal',
              lineHeight: '38.4px',
              letterSpacing: 'normal',
              textTransform: 'none',
            },
            children: [
              {
                sourceId: 'node-shadow',
                type: 'TEXT',
                name: 'span',
                characters: 'From shadow DOM',
                attributes: {},
                resources: [],
                fillStyleId: 'color-111827',
                textStyleId: 'type-inter-32-700-normal-38.4-0-none',
                styles: {
                  color: '#111827',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '32px',
                  fontWeight: '700',
                  fontStyle: 'normal',
                  lineHeight: '38.4px',
                  letterSpacing: 'normal',
                  textTransform: 'none',
                },
                children: [],
              },
            ],
          },
        ],
      },
    });
  });
});
