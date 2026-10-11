import { describe, expect, test } from 'vitest';

import type { ExtractionNode } from '../../../src/contracts/extraction/extraction-document.js';
import { createColorStyleCatalog, createTypographyStyleCatalog } from '../../../src/figma/style-catalog.js';

function node(
  id: string,
  styles: Record<string, string> = {},
  children: ExtractionNode[] = [],
): ExtractionNode {
  return {
    id,
    tagName: 'div',
    attributes: {},
    resources: [],
    text: null,
    styles,
    pseudoElements: { before: null, after: null },
    children,
  };
}

describe('createColorStyleCatalog', () => {
  test('deduplicates identical RGBA colors and gives them a stable ID', () => {
    const catalog = createColorStyleCatalog(node('node-1', {
      color: 'rgb(17, 24, 39)',
      'border-top-color': 'rgba(17, 24, 39, 1)',
    }, [node('node-2', { 'background-color': '#111827' })]));

    expect(catalog).toEqual([
      {
        id: 'color-111827',
        name: '#111827',
        rgba: { r: 0.067, g: 0.094, b: 0.153, a: 1 },
      },
    ]);
  });

  test('uses a deterministic alpha-aware ID for non-opaque solid colors', () => {
    const catalog = createColorStyleCatalog(node('node-1', {
      color: 'rgba(255, 0, 16, 0.5)',
    }));

    expect(catalog).toEqual([
      {
        id: 'color-ff0010-80',
        name: '#ff0010 / 50%',
        rgba: { r: 1, g: 0, b: 0.063, a: 0.5 },
      },
    ]);
  });

  test('does not create color styles for gradients, images, filters, or blend modes', () => {
    const catalog = createColorStyleCatalog(node('node-1', {}, [
      node('gradient', {
        'background-color': 'rgb(255, 0, 0)',
        'background-image': 'linear-gradient(red, blue)',
      }),
      node('image', {
        color: 'rgb(0, 255, 0)',
        'background-image': 'url("https://example.com/image.png")',
      }),
      node('filter', {
        color: 'rgb(0, 0, 255)',
        filter: 'blur(2px)',
      }),
      node('blend', {
        color: 'rgb(255, 255, 0)',
        'mix-blend-mode': 'multiply',
      }),
    ]));

    expect(catalog).toEqual([]);
  });
});

describe('createTypographyStyleCatalog', () => {
  test('deduplicates an identical seven-property typography tuple with a stable ID', () => {
    const typography = {
      'font-family': 'Inter, sans-serif',
      'font-size': '32px',
      'font-weight': '700',
      'font-style': 'normal',
      'line-height': '38.4px',
      'letter-spacing': 'normal',
      'text-transform': 'none',
    };
    const root = node('node-1', typography, [node('node-2', { ...typography })]);
    root.shadowChildren = [node('node-3', { ...typography })];

    expect(createTypographyStyleCatalog(root)).toEqual([
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
    ]);
  });

  test('keeps distinct typography tuples separate and ignores incomplete tuples', () => {
    const base = {
      'font-family': 'Inter, sans-serif',
      'font-size': '16px',
      'font-weight': '400',
      'font-style': 'normal',
      'line-height': '24px',
      'letter-spacing': 'normal',
      'text-transform': 'none',
    };

    const catalog = createTypographyStyleCatalog(node('node-1', base, [
      node('node-2', { ...base, 'font-weight': '700' }),
      node('node-3', { 'font-family': 'Inter, sans-serif', 'font-size': '16px' }),
    ]));

    expect(catalog.map((style) => style.id)).toEqual([
      'type-inter-16-400-normal-24-0-none',
      'type-inter-16-700-normal-24-0-none',
    ]);
  });
});
