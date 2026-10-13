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
      type: 'FRAME',
      rect: { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0 },
      isVisible: true,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }],
      children: [
        {
          id: 'node-heading',
          tag: 'h1',
          type: 'TEXT',
          rect: { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0 },
          relativeRect: { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0 },
          isVisible: true,
          characters: 'Welcome',
          children: [],
        },
        {
          id: 'node-shadow',
          tag: 'span',
          type: 'TEXT',
          rect: { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0 },
          relativeRect: { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0 },
          isVisible: true,
          characters: 'From shadow DOM',
          children: [],
        },
      ],
    });
  });

  test('emits ordered leaf TEXT runs without assigning descendant text to containers', () => {
    const extraction = node({
      id: 'node-root',
      tagName: 'p',
      text: 'First second third',
      children: [
        node({ id: 'node-first', tagName: 'span', text: 'First' }),
        node({ id: 'node-second', tagName: 'strong', text: 'second' }),
        node({ id: 'node-third', tagName: 'em', text: 'third' }),
      ],
    });

    expect(transformExtractionNode(extraction)).toMatchObject({
      id: 'node-root',
      type: 'FRAME',
      children: [
        { id: 'node-first', type: 'TEXT', characters: 'First', children: [] },
        { id: 'node-second', type: 'TEXT', characters: 'second', children: [] },
        { id: 'node-third', type: 'TEXT', characters: 'third', children: [] },
      ],
    });
    expect(transformExtractionNode(extraction).characters).toBeUndefined();
  });

  test('normalizes the style of every TEXT run into Figma typography values', () => {
    const result = transformExtractionNode(node({
      tagName: 'span',
      text: 'Styled text',
      styles: {
        'font-family': '"Inter", Arial, sans-serif',
        'font-size': '16px',
        'font-weight': '600',
        'line-height': '24px',
        'letter-spacing': '0.5px',
        'text-align': 'center',
      },
    }));

    expect(result.styles).toEqual({
      fontFamily: 'Inter',
      fontSize: 16,
      fontWeight: 600,
      lineHeight: 24,
      letterSpacing: 0.5,
      textAlign: 'CENTER',
      textAutoResize: 'HEIGHT',
    });
  });

  test('maps flex layouts to their Figma axis and numeric gap', () => {
    const horizontal = transformExtractionNode(node({
      styles: { display: 'flex', 'flex-direction': 'row', gap: '16px' },
    }));
    const vertical = transformExtractionNode(node({
      styles: { display: 'inline-flex', 'flex-direction': 'column-reverse', gap: '1.5px' },
    }));

    expect(horizontal).toMatchObject({ layoutMode: 'HORIZONTAL', gap: 16 });
    expect(vertical).toMatchObject({ layoutMode: 'VERTICAL', gap: 1.5 });
  });

  test('maps grids to horizontal Auto Layout and omits non-numeric gaps', () => {
    const result = transformExtractionNode(node({
      styles: { display: 'grid', gap: 'normal' },
    }));

    expect(result.layoutMode).toBe('HORIZONTAL');
    expect(result.gap).toBeUndefined();
  });

  test('maps perceptible paints, borders, shadows, and corner radii to structured Figma values', () => {
    const result = transformExtractionNode(node({
      styles: {
        'background-color': 'rgb(17, 34, 51)',
        'border-top-style': 'solid',
        'border-top-width': '2px',
        'border-top-color': 'rgba(68, 85, 102, 0.5)',
        'border-right-style': 'none',
        'border-right-width': '4px',
        'border-right-color': 'rgb(255, 0, 0)',
        'box-shadow': '2px 3px 4px 5px rgba(0, 0, 0, 0.25)',
        'border-top-left-radius': '4px',
        'border-top-right-radius': '8px',
        'border-bottom-right-radius': '12px',
        'border-bottom-left-radius': '16px',
      },
    }));

    expect(result).toMatchObject({
      fills: [{ type: 'SOLID', color: { r: 0.067, g: 0.133, b: 0.2, a: 1 } }],
      strokes: [{ type: 'SOLID', weight: 2, color: { r: 0.267, g: 0.333, b: 0.4, a: 0.5 } }],
      effects: [{
        type: 'DROP_SHADOW',
        color: { r: 0, g: 0, b: 0, a: 0.25 },
        offset: { x: 2, y: 3 },
        radius: 4,
        spread: 5,
      }],
      cornerRadii: { topLeft: 4, topRight: 8, bottomRight: 12, bottomLeft: 16 },
    });
  });

  test('maps an img with its resolved source and measured image data', () => {
    const result = transformExtractionNode(node({
      tagName: 'img',
      attributes: { src: 'images/logo.png' },
      resources: [{ kind: 'image', url: 'https://example.com/images/logo.png' }],
      layout: {
        rect: { x: 0, y: 0, width: 120, height: 80, top: 0, left: 0 },
        naturalWidth: 240,
        naturalHeight: 160,
        objectFit: 'contain',
      },
    }));

    expect(result).toMatchObject({
      type: 'IMAGE',
      image: {
        src: 'https://example.com/images/logo.png',
        naturalWidth: 240,
        naturalHeight: 160,
        objectFit: 'contain',
      },
    });
  });

  test('does not invent image data for an element classified from its background', () => {
    const result = transformExtractionNode(node({
      tagName: 'div',
      styles: { 'background-image': 'url("https://example.com/background.png")' },
    }));

    expect(result.type).toBe('IMAGE');
    expect(result.image).toBeUndefined();
  });

  test('serializes an inline SVG into the Figma node', () => {
    const result = transformExtractionNode(node({
      tagName: 'svg',
      attributes: { viewBox: '0 0 24 24', role: 'img' },
      children: [node({ id: 'node-path', tagName: 'path' })],
    }));

    expect(result).toMatchObject({
      type: 'FRAME',
      svg: '<svg viewBox="0 0 24 24" role="img"><path></path></svg>',
    });
  });

  test('prunes a zero CSS gap while retaining the structural Auto Layout mode', () => {
    const result = transformExtractionNode(node({
      styles: { display: 'flex', 'flex-direction': 'row', gap: '0px' },
    }));

    expect(result.layoutMode).toBe('HORIZONTAL');
    expect(result.gap).toBeUndefined();
  });

  test('keeps normalized typography values required by the structured text contract', () => {
    const result = transformExtractionNode(node({
      tagName: 'span',
      text: 'Default typography',
      styles: {
        'font-family': 'Inter, sans-serif',
        'font-size': '16px',
        'font-weight': 'normal',
        'line-height': 'normal',
        'letter-spacing': 'normal',
        'text-align': 'start',
      },
    }));

    expect(result.styles).toEqual({
      fontFamily: 'Inter',
      fontSize: 16,
      fontWeight: 400,
      lineHeight: 19.2,
      letterSpacing: 0,
      textAlign: 'LEFT',
      textAutoResize: 'HEIGHT',
    });
  });

  test('maps absolute and sticky positioning with a numeric z-index only', () => {
    const absolute = transformExtractionNode(node({
      styles: { position: 'absolute', 'z-index': '20' },
    }));
    const sticky = transformExtractionNode(node({
      styles: { position: 'sticky', 'z-index': 'auto' },
    }));
    const relative = transformExtractionNode(node({
      styles: { position: 'relative', 'z-index': '4' },
    }));

    expect(absolute).toMatchObject({ position: 'absolute', zIndex: 20 });
    expect(sticky).toMatchObject({ position: 'sticky' });
    expect(sticky.zIndex).toBeUndefined();
    expect(relative.position).toBeUndefined();
    expect(relative.zIndex).toBeUndefined();
  });

  test('omits the root relative rect and positions descendants from their represented parent content area', () => {
    const extraction = node({
      id: 'node-root',
      layout: {
        rect: { x: 10, y: 20, width: 400, height: 300, top: 20, left: 10 },
      },
      styles: {
        'border-left-width': '2px',
        'border-top-width': '3px',
        'padding-left': '11px',
        'padding-top': '13px',
      },
      children: [node({
        id: 'node-child',
        layout: {
          rect: { x: 40, y: 60, width: 100, height: 50, top: 60, left: 40 },
        },
        children: [node({
          id: 'node-grandchild',
          layout: {
            rect: { x: 50, y: 70, width: 20, height: 10, top: 70, left: 50 },
          },
        })],
      })],
    });

    const result = transformExtractionNode(extraction);

    expect(result.relativeRect).toBeUndefined();
    expect(result.children[0]?.relativeRect).toEqual({
      x: 17, y: 24, width: 100, height: 50, top: 24, left: 17,
    });
    expect(result.children[0]?.children[0]?.relativeRect).toEqual({
      x: 10, y: 10, width: 20, height: 10, top: 10, left: 10,
    });
  });

  test('emits only finite numeric values when source layout measurements are invalid', () => {
    const result = transformExtractionNode(node({
      layout: {
        rect: { x: Number.NaN, y: Number.POSITIVE_INFINITY, width: Number.NEGATIVE_INFINITY, height: 4, top: Number.NaN, left: 3 },
      },
      children: [node({
        id: 'node-child',
        layout: {
          rect: { x: Number.NaN, y: 5, width: 6, height: Number.POSITIVE_INFINITY, top: 5, left: Number.NaN },
        },
      })],
    }));

    expect(result.rect).toEqual({ x: 0, y: 0, width: 0, height: 4, top: 0, left: 3 });
    expect(result.children[0]?.rect).toEqual({ x: 0, y: 5, width: 6, height: 0, top: 5, left: 0 });
    expect(result.children[0]?.relativeRect).toEqual({ x: 0, y: 5, width: 6, height: 0, top: 5, left: 0 });
  });

  const visibilityCases: Array<[
    description: string,
    styles: Record<string, string>,
    attributes: Record<string, string>,
    dimensions: { width: number; height: number },
    isVisible: boolean,
    hasOffsetParent?: boolean,
  ]> = [
    ['display none', { display: 'none' }, {}, { width: 100, height: 50 }, false],
    ['hidden visibility', { visibility: 'hidden' }, {}, { width: 100, height: 50 }, false],
    ['hidden attribute', {}, { hidden: '' }, { width: 100, height: 50 }, false],
    ['zero opacity', { opacity: '0' }, {}, { width: 100, height: 50 }, false],
    ['zero-sized box', {}, {}, { width: 0, height: 50 }, false],
    ['visible measured element', { display: 'block', visibility: 'visible', opacity: '1' }, {}, { width: 100, height: 50 }, true, true],
  ];

  test.each(visibilityCases)('determines real visibility for %s', (
    _description,
    styles,
    attributes,
    dimensions,
    isVisible,
    hasOffsetParent,
  ) => {
    const result = transformExtractionNode(node({
      styles,
      attributes,
      layout: {
        rect: { x: 0, y: 0, top: 0, left: 0, ...dimensions },
        ...(hasOffsetParent === undefined ? {} : { hasOffsetParent }),
      },
    }));

    expect(result.isVisible).toBe(isVisible);
  });

  test('marks a regular descendant without an applicable offset parent as hidden', () => {
    const visibleBox = { rect: { x: 0, y: 0, width: 100, height: 50, top: 0, left: 0 }, hasOffsetParent: false };
    const result = transformExtractionNode(node({
      layout: { rect: { x: 0, y: 0, width: 200, height: 100, top: 0, left: 0 } },
      children: [node({ id: 'node-child', layout: visibleBox })],
    }));

    expect(result.children[0]?.isVisible).toBe(false);
  });

  test('does not treat the root, SVG, or fixed elements with a box as hidden when offsetParent is absent', () => {
    const visibleBox = { rect: { x: 0, y: 0, width: 100, height: 50, top: 0, left: 0 }, hasOffsetParent: false };
    const result = transformExtractionNode(node({
      tagName: 'html',
      layout: visibleBox,
      children: [
        node({ id: 'node-svg', tagName: 'svg', layout: visibleBox }),
        node({ id: 'node-fixed', styles: { position: 'fixed' }, layout: visibleBox }),
      ],
    }));

    expect(result.isVisible).toBe(true);
    expect(result.children.map((child) => child.isVisible)).toEqual([true, true]);
  });

  test('removes invisible subtrees when includeHidden is false', () => {
    const visibleBox = { rect: { x: 0, y: 0, width: 100, height: 50, top: 0, left: 0 } };
    const result = transformExtractionNode(node({
      id: 'node-root',
      layout: visibleBox,
      children: [
        node({ id: 'node-visible', layout: visibleBox }),
        node({
          id: 'node-hidden',
          styles: { display: 'none' },
          layout: visibleBox,
          children: [node({ id: 'node-hidden-descendant', layout: visibleBox })],
        }),
      ],
    }), { includeHidden: false });

    expect(result.children.map((child) => child.id)).toEqual(['node-visible']);
  });

  test('preserves invisible subtrees marked as hidden when includeHidden is true', () => {
    const visibleBox = { rect: { x: 0, y: 0, width: 100, height: 50, top: 0, left: 0 } };
    const result = transformExtractionNode(node({
      id: 'node-root',
      layout: visibleBox,
      children: [node({
        id: 'node-hidden',
        styles: { opacity: '0' },
        layout: visibleBox,
        children: [node({ id: 'node-hidden-descendant', layout: visibleBox })],
      })],
    }), { includeHidden: true });

    expect(result.children).toMatchObject([{
      id: 'node-hidden',
      isVisible: false,
      children: [{ id: 'node-hidden-descendant', isVisible: false }],
    }]);
  });

  test.each([
    ['html', null, [], {}, 'FRAME'],
    ['svg', null, [], {}, 'FRAME'],
    ['img', null, [], {}, 'IMAGE'],
    ['div', null, [], { 'background-image': 'url("https://example.com/background.png")' }, 'IMAGE'],
    ['div', null, [], { 'background-image': 'none' }, 'FRAME'],
    ['div', 'Visible text', [], {}, 'TEXT'],
    ['div', '', [], {}, 'FRAME'],
    ['div', 'Text with an element child', [node({ id: 'node-child' })], {}, 'FRAME'],
    ['div', 'Text with a shadow child', [], {}, 'FRAME', [node({ id: 'node-shadow-child' })]],
    ['div', null, [], {}, 'FRAME'],
  ] as [
    string,
    string | null,
    ExtractionNode[],
    Record<string, string>,
    FigmaNodeType,
    ExtractionNode[]?,
  ][])('maps %s nodes to the permitted node type', (tagName, text, children, styles, type, shadowChildren) => {
    expect(transformExtractionNode(node({ tagName, text, children, styles, shadowChildren }))).toMatchObject({ type });
  });
});

describe('transformExtractionDocument', () => {
  test('collects deterministic font assets for visible included text runs', () => {
    const typography = {
      'font-size': '16px',
      'font-style': 'normal',
      'line-height': '24px',
      'letter-spacing': 'normal',
      'text-transform': 'none',
    };
    const visibleBox = { rect: { x: 0, y: 0, width: 100, height: 50, top: 0, left: 0 } };
    const extraction: ExtractionDocument = {
      schemaVersion: '1.0',
      source: {
        url: 'https://example.com/',
        viewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
        environment: { locale: 'en-US', timezone: 'UTC', colorScheme: 'light', reducedMotion: 'no-preference' },
      },
      document: node({
        id: 'node-root',
        tagName: 'html',
        layout: visibleBox,
        children: [
          node({
            id: 'node-inter-regular',
            tagName: 'span',
            text: 'Regular',
            layout: visibleBox,
            styles: { ...typography, 'font-family': 'Inter, sans-serif', 'font-weight': '400' },
          }),
          node({
            id: 'node-inter-bold',
            tagName: 'span',
            text: 'Bold',
            layout: visibleBox,
            styles: { ...typography, 'font-family': '"Inter", Arial', 'font-weight': '700' },
          }),
          node({
            id: 'node-hidden',
            tagName: 'span',
            text: 'Hidden',
            layout: visibleBox,
            styles: { ...typography, 'font-family': 'Roboto, sans-serif', 'font-weight': '500', display: 'none' },
          }),
        ],
      }),
    };

    expect(transformExtractionDocument(extraction).assets).toEqual([
      { family: 'Inter', weights: [400, 700] },
    ]);
  });

  test('builds catalogs only from perceptible resources used by visible included nodes', () => {
    const typography = {
      'font-family': 'Inter, sans-serif',
      'font-size': '16px',
      'font-weight': '400',
      'font-style': 'normal',
      'line-height': '24px',
      'letter-spacing': 'normal',
      'text-transform': 'none',
    };
    const visibleBox = { rect: { x: 0, y: 0, width: 100, height: 50, top: 0, left: 0 } };
    const extraction: ExtractionDocument = {
      schemaVersion: '1.0',
      source: {
        url: 'https://example.com/',
        viewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
        environment: { locale: 'en-US', timezone: 'UTC', colorScheme: 'light', reducedMotion: 'no-preference' },
      },
      document: node({
        id: 'node-root',
        tagName: 'html',
        layout: visibleBox,
        styles: { ...typography },
        children: [
          node({
            id: 'node-visible-text',
            tagName: 'span',
            text: 'Visible',
            layout: visibleBox,
            styles: { color: 'rgb(17, 34, 51)', ...typography },
          }),
          node({
            id: 'node-hidden-text',
            tagName: 'span',
            text: 'Hidden',
            layout: visibleBox,
            styles: { color: 'rgb(68, 85, 102)', display: 'none', ...typography },
          }),
          node({
            id: 'node-transparent',
            layout: visibleBox,
            styles: { 'background-color': 'rgba(255, 0, 0, 0)' },
          }),
          node({
            id: 'node-gradient',
            layout: visibleBox,
            styles: {
              'background-color': 'rgb(0, 255, 0)',
              'background-image': 'linear-gradient(red, blue)',
            },
          }),
        ],
      }),
    };

    const result = transformExtractionDocument(extraction);

    expect(result.styles.colors).toEqual([{
      id: 'color-112233',
      name: '#112233',
      rgba: { r: 0.067, g: 0.133, b: 0.2, a: 1 },
    }]);
    expect(result.styles.typographies).toEqual([{
      id: 'type-inter-16-400-normal-24-0-none',
      fontFamily: 'Inter, sans-serif',
      fontSize: '16px',
      fontWeight: '400',
      fontStyle: 'normal',
      lineHeight: '24px',
      letterSpacing: 'normal',
      textTransform: 'none',
    }]);
  });

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
            type: 'FRAME',
            rect: { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0 },
            relativeRect: { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0 },
            isVisible: true,
            children: [
              {
                id: 'node-shadow',
                tag: 'span',
                type: 'TEXT',
                rect: { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0 },
                relativeRect: { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0 },
                isVisible: true,
                characters: 'From shadow DOM',
                children: [],
              },
            ],
          },
        ],
      },
    });
  });
});
