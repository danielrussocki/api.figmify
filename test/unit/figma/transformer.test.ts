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
  test('emits exactly an empty fills array without a fallback color for a frame without a perceptible background', () => {
    const extraction: ExtractionDocument = {
      schemaVersion: '1.0',
      source: {
        url: 'https://example.com/',
        viewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
        environment: { locale: 'en-US', timezone: 'UTC', colorScheme: 'light', reducedMotion: 'no-preference' },
      },
      document: node({
        styles: { color: 'rgb(17, 24, 39)', 'background-color': 'transparent' },
      }),
    };

    const result = transformExtractionDocument(extraction);

    expect(result.document).toHaveProperty('fills');
    expect(result.document.fills).toEqual([]);
    expect(result.document.fills).not.toBeNull();
    expect(result.styles.colors).toEqual([]);
  });

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
          fills: [],
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
          fills: [],
          characters: 'From shadow DOM',
          children: [],
        },
      ],
    });
  });

  test('maps positive fractional opacity to visible nodes without retaining it in text styles', () => {
    const visibleBox = { rect: { x: 0, y: 0, width: 100, height: 50, top: 0, left: 0 } };
    const result = transformExtractionNode(node({
      id: 'node-frame',
      layout: visibleBox,
      styles: { opacity: '0.8' },
      children: [
        node({
          id: 'node-image',
          tagName: 'img',
          layout: visibleBox,
          styles: { opacity: '0.5' },
        }),
        node({
          id: 'node-text',
          tagName: 'span',
          text: 'Visible text',
          layout: visibleBox,
          styles: {
            opacity: '0.5',
            'font-family': 'Inter, sans-serif',
            'font-size': '16px',
            'font-weight': '400',
            'line-height': '19.2px',
            'letter-spacing': '0px',
          },
        }),
      ],
    }), { includeHidden: false });

    expect(result).toMatchObject({ type: 'FRAME', opacity: 0.8, isVisible: true });
    expect(result).not.toHaveProperty('styles.opacity');
    expect(result.children).toMatchObject([
      { id: 'node-image', type: 'IMAGE', opacity: 0.5, isVisible: true },
      {
        id: 'node-text',
        type: 'TEXT',
        opacity: 0.5,
        isVisible: true,
        styles: { fontFamily: 'Inter', fontSize: 16 },
      },
    ]);
    expect(result.children[0]).not.toHaveProperty('styles.opacity');
    expect(result.children[1]).not.toHaveProperty('styles.opacity');
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

  test('interleaves direct text runs and element text leaves in DOM order with independent styles', () => {
    const parentStyles = {
      'font-family': 'Inter, sans-serif',
      'font-size': '16px',
      'font-weight': '400',
      'line-height': 'normal',
      'letter-spacing': 'normal',
      'text-align': 'left',
    };
    const extraction = node({
      id: 'node-paragraph',
      tagName: 'p',
      styles: parentStyles,
      directTextRuns: [
        { characters: 'Hello ', childNodeIndex: 0, styles: parentStyles },
        { characters: '!', childNodeIndex: 2, styles: parentStyles },
      ],
      children: [node({
        id: 'node-emphasis',
        tagName: 'em',
        text: 'world',
        styles: {
          ...parentStyles,
          'font-weight': '700',
          'font-style': 'italic',
        },
      })],
    });

    const result = transformExtractionNode(extraction);

    expect(result.type).toBe('FRAME');
    expect(result.characters).toBeUndefined();
    expect(result.children).toMatchObject([
      {
        id: 'node-paragraph-text-0',
        tag: '#text',
        type: 'TEXT',
        characters: 'Hello ',
        styles: { fontFamily: 'Inter', fontWeight: 400, lineHeight: 19.2 },
        children: [],
      },
      {
        id: 'node-emphasis',
        tag: 'em',
        type: 'TEXT',
        characters: 'world',
        styles: { fontFamily: 'Inter', fontWeight: 700, lineHeight: 19.2 },
        children: [],
      },
      {
        id: 'node-paragraph-text-2',
        tag: '#text',
        type: 'TEXT',
        characters: '!',
        styles: { fontFamily: 'Inter', fontWeight: 400, lineHeight: 19.2 },
        children: [],
      },
    ]);
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

  test.each([
    ['row', 'HORIZONTAL'],
    ['row-reverse', 'HORIZONTAL'],
    ['column', 'VERTICAL'],
    ['column-reverse', 'VERTICAL'],
  ] as const)('maps flex-direction %s to the %s Figma layout mode', (flexDirection, layoutMode) => {
    const result = transformExtractionNode(node({
      styles: { display: 'inline-flex', 'flex-direction': flexDirection, gap: '16px' },
    }));

    expect(result).toMatchObject({ layoutMode, gap: 16 });
  });

  test('maps flex main-axis spacing and all physical padding values', () => {
    const result = transformExtractionNode(node({
      styles: {
        display: 'flex',
        'flex-direction': 'row',
        'column-gap': '16px',
        'row-gap': '8px',
        'padding-top': '4px',
        'padding-right': '8px',
        'padding-bottom': '12px',
        'padding-left': '16px',
      },
    }));

    expect(result).toMatchObject({
      layoutMode: 'HORIZONTAL',
      itemSpacing: 16,
      gap: 16,
      padding: { top: 4, right: 8, bottom: 12, left: 16 },
    });
  });

  test('uses row-gap as the spacing for vertical flex layouts', () => {
    const result = transformExtractionNode(node({
      styles: {
        display: 'inline-flex',
        'flex-direction': 'column-reverse',
        'column-gap': '16px',
        'row-gap': '8px',
      },
    }));

    expect(result).toMatchObject({
      layoutMode: 'VERTICAL',
      itemSpacing: 8,
      gap: 8,
    });
  });

  test('emits layoutGrow only for positive flex growth in-flow Auto Layout children', () => {
    const result = transformExtractionNode(node({
      id: 'node-parent',
      styles: { display: 'flex' },
      children: [
        node({ id: 'node-growing', styles: { 'flex-grow': '1.5' } }),
        node({ id: 'node-zero', styles: { 'flex-grow': '0' } }),
        node({ id: 'node-absolute', styles: { 'flex-grow': '2', position: 'absolute' } }),
        node({ id: 'node-fixed', styles: { 'flex-grow': '3', position: 'fixed' } }),
      ],
    }));

    expect(result.children).toMatchObject([
      { id: 'node-growing', layoutGrow: 1.5 },
      { id: 'node-zero' },
      { id: 'node-absolute' },
      { id: 'node-fixed' },
    ]);
    expect(result.children.map((child) => child.layoutGrow)).toEqual([1.5, undefined, undefined, undefined]);
  });

  test('omits layoutGrow for a positive flex-grow node outside an Auto Layout parent', () => {
    const result = transformExtractionNode(node({
      styles: { 'flex-grow': '2' },
    }));

    expect(result.layoutGrow).toBeUndefined();
  });

  test.each([
    ['flex-start', 'flex-start', 'MIN', 'MIN'],
    ['start', 'start', 'MIN', 'MIN'],
    ['center', 'center', 'CENTER', 'CENTER'],
    ['flex-end', 'flex-end', 'MAX', 'MAX'],
    ['end', 'end', 'MAX', 'MAX'],
    ['space-between', 'center', 'SPACE_BETWEEN', 'CENTER'],
  ] as const)('maps direct flex alignment equivalents for justify-content=%s and align-items=%s', (
    justifyContent,
    alignItems,
    primaryAxisAlign,
    counterAxisAlign,
  ) => {
    const result = transformExtractionNode(node({
      styles: {
        display: 'flex',
        'justify-content': justifyContent,
        'align-items': alignItems,
      },
    }));

    expect(result.primaryAxisAlign).toBe(primaryAxisAlign);
    expect(result.counterAxisAlign).toBe(counterAxisAlign);
  });

  test.each([
    ['stretch', 'stretch'],
    ['baseline', 'baseline'],
    ['space-around', 'space-around'],
    ['space-evenly', 'space-evenly'],
    ['left', 'right'],
  ])('omits inexact flex alignment values for justify-content=%s and align-items=%s', (
    justifyContent,
    alignItems,
  ) => {
    const result = transformExtractionNode(node({
      styles: {
        display: 'inline-flex',
        'justify-content': justifyContent,
        'align-items': alignItems,
      },
    }));

    expect(result.primaryAxisAlign).toBeUndefined();
    expect(result.counterAxisAlign).toBeUndefined();
  });

  test('omits Auto Layout properties for a node that is neither flex nor grid', () => {
    const result = transformExtractionNode(node({
      styles: { display: 'block', 'flex-direction': 'column', gap: '16px' },
    }));

    expect(result.layoutMode).toBeUndefined();
    expect(result.gap).toBeUndefined();
  });

  test.each([
    ['column', 'VERTICAL', '18px', '6px', 6],
    ['row', 'HORIZONTAL', '4px', '14px', 4],
  ] as const)('maps grid-auto-flow %s to its main axis and matching spacing', (
    gridAutoFlow,
    layoutMode,
    columnGap,
    rowGap,
    spacing,
  ) => {
    const result = transformExtractionNode(node({
      styles: {
        display: 'grid',
        'grid-auto-flow': gridAutoFlow,
        'column-gap': columnGap,
        'row-gap': rowGap,
      },
    }));

    expect(result).toMatchObject({ layoutMode, itemSpacing: spacing, gap: spacing });
  });

  test('uses the repeated grid track dimension when grid-auto-flow is unavailable', () => {
    const result = transformExtractionNode(node({
      styles: {
        display: 'grid',
        'grid-template-columns': '80px',
        'grid-template-rows': '80px 80px 80px',
        'column-gap': '4px',
        'row-gap': '14px',
      },
    }));

    expect(result).toMatchObject({ layoutMode: 'VERTICAL', itemSpacing: 14, gap: 14 });
  });

  test('normalizes an ineffective grid gap to zero', () => {
    const result = transformExtractionNode(node({
      styles: { display: 'grid', 'grid-auto-flow': 'row', 'column-gap': 'normal' },
    }));

    expect(result).toMatchObject({ layoutMode: 'HORIZONTAL', itemSpacing: 0, gap: 0 });
  });

  test('emits complete physical padding for a grid Auto Layout container', () => {
    const result = transformExtractionNode(node({
      styles: {
        display: 'inline-grid',
        'padding-top': '6px',
        'padding-right': 'invalid',
        'padding-bottom': '12px',
      },
    }));

    expect(result).toMatchObject({
      layoutMode: 'HORIZONTAL',
      padding: { top: 6, right: 0, bottom: 12, left: 0 },
    });
    Object.values(result.padding ?? {}).forEach((value) => expect(value).toBeTypeOf('number'));
  });

  test('emits four numeric zero padding values for a grid Auto Layout container', () => {
    const result = transformExtractionNode(node({
      styles: {
        display: 'grid',
        'padding-top': '0px',
        'padding-right': '0px',
        'padding-bottom': '0px',
        'padding-left': '0px',
      },
    }));

    expect(result).toMatchObject({
      layoutMode: 'HORIZONTAL',
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    Object.values(result.padding ?? {}).forEach((value) => expect(value).toBeTypeOf('number'));
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

  test('keeps an element with a CSS background image as a FRAME with its children and Auto Layout', () => {
    const result = transformExtractionNode(node({
      id: 'node-background-frame',
      styles: {
        display: 'flex',
        'flex-direction': 'row',
        'column-gap': '12px',
        'background-image': 'url("https://example.com/images/hero.png")',
      },
      children: [node({ id: 'node-background-child' })],
    }));

    expect(result).toMatchObject({
      id: 'node-background-frame',
      type: 'FRAME',
      layoutMode: 'HORIZONTAL',
      itemSpacing: 12,
      gap: 12,
      children: [{ id: 'node-background-child', type: 'FRAME' }],
    });
    expect(result).not.toHaveProperty('image');
  });

  test('uses an IMAGE paint rather than a SOLID paint for an img node', () => {
    const result = transformExtractionNode(node({
      id: 'node-root',
      children: [
        node({
          id: 'node-img',
          tagName: 'img',
          resources: [{ kind: 'image', url: 'https://example.com/images/logo.png' }],
          layout: {
            rect: { x: 0, y: 0, width: 120, height: 80, top: 0, left: 0 },
            naturalWidth: 240,
            naturalHeight: 160,
            objectFit: 'contain',
          },
        }),
      ],
    }));

    const imageNodes = result.children.filter((child) => child.type === 'IMAGE');

    expect(imageNodes).toHaveLength(1);
    expect(imageNodes).toEqual([
      expect.objectContaining({
        id: 'node-img',
        fills: [{ type: 'IMAGE', src: 'https://example.com/images/logo.png', scaleMode: 'FIT' }],
      }),
    ]);
    expect(imageNodes.flatMap((imageNode) => imageNode.fills ?? []))
      .not.toContainEqual(expect.objectContaining({ type: 'SOLID' }));
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
      fills: [{ type: 'IMAGE', src: 'https://example.com/images/logo.png', scaleMode: 'FIT' }],
      image: {
        src: 'https://example.com/images/logo.png',
        naturalWidth: 240,
        naturalHeight: 160,
        objectFit: 'contain',
      },
    });
  });

  test.each([
    ['cover', 'FILL'],
    ['fill', 'FILL'],
    ['contain', 'FIT'],
    ['scale-down', 'FIT'],
    ['none', 'CROP'],
  ] as const)('maps img object-fit %s to IMAGE paint scaleMode %s', (objectFit, scaleMode) => {
    const result = transformExtractionNode(node({
      tagName: 'img',
      resources: [{ kind: 'image', url: 'https://example.com/images/photo.png' }],
      layout: {
        rect: { x: 0, y: 0, width: 120, height: 80, top: 0, left: 0 },
        naturalWidth: 240,
        naturalHeight: 160,
        objectFit,
      },
    }));

    expect(result.fills).toEqual([
      { type: 'IMAGE', src: 'https://example.com/images/photo.png', scaleMode },
    ]);
  });

  test('emits a CSS background IMAGE paint in a FRAME without image metadata', () => {
    const result = transformExtractionNode(node({
      tagName: 'div',
      styles: {
        'background-image': 'url("https://example.com/background.png")',
        'background-size': 'cover',
      },
    }));

    expect(result).toMatchObject({
      type: 'FRAME',
      fills: [{ type: 'IMAGE', src: 'https://example.com/background.png', scaleMode: 'FILL' }],
    });
    expect(result.image).toBeUndefined();
  });

  test.each([
    ['repeats horizontally', 'cover', 'repeat-x', 'TILE'],
    ['repeats vertically', 'contain', 'repeat-y', 'TILE'],
    ['repeats in both axes', 'auto', 'repeat', 'TILE'],
    ['covers without repeating', 'cover', 'no-repeat', 'FILL'],
    ['contains without repeating', 'contain', 'no-repeat', 'FIT'],
    ['uses automatic size without repeating', 'auto', 'no-repeat', 'CROP'],
    ['uses an explicit size without repeating', '160px 80px', 'no-repeat', 'CROP'],
  ] as const)('maps a CSS background that %s to IMAGE paint scaleMode %s', (
    _,
    backgroundSize,
    backgroundRepeat,
    scaleMode,
  ) => {
    const result = transformExtractionNode(node({
      tagName: 'div',
      styles: {
        'background-image': 'url("https://example.com/background.png")',
        'background-size': backgroundSize,
        'background-repeat': backgroundRepeat,
      },
    }));

    expect(result).toMatchObject({
      type: 'FRAME',
      fills: [{ type: 'IMAGE', src: 'https://example.com/background.png', scaleMode }],
    });
  });

  test('orders a CSS background IMAGE paint before its perceptible solid background paint', () => {
    const result = transformExtractionNode(node({
      tagName: 'section',
      styles: {
        'background-image': 'url("https://example.com/background.png")',
        'background-color': 'rgb(17, 34, 51)',
      },
    }));

    expect(result.fills).toEqual([
      { type: 'IMAGE', src: 'https://example.com/background.png', scaleMode: 'CROP' },
      { type: 'SOLID', color: { r: 0.067, g: 0.133, b: 0.2, a: 1 } },
    ]);
  });

  test.each([
    ['multiple background sources', 'url("https://example.com/first.png"), url("https://example.com/second.png")', 'cover'],
    ['unknown background size', 'url("https://example.com/background.png")', 'auto'],
    ['unresolvable background source', 'url("/background.png")', 'contain'],
  ])('omits background image data for %s', (_, backgroundImage, backgroundSize) => {
    const result = transformExtractionNode(node({
      tagName: 'div',
      resources: [{ kind: 'image', url: 'https://example.com/background.png' }],
      styles: { 'background-image': backgroundImage, 'background-size': backgroundSize },
    }));

    expect(result.type).toBe('FRAME');
    expect(result.image).toBeUndefined();
  });

  test.each([
    ['an unresolvable URL', 'url("/images/hero.png")'],
    ['multiple background images', 'url("https://example.com/first.png"), url("https://example.com/second.png")'],
    ['a gradient', 'linear-gradient(rgb(255, 0, 0), rgb(0, 0, 255))'],
  ])('keeps a %s background as a FRAME without inventing an IMAGE paint', (_, backgroundImage) => {
    const result = transformExtractionNode(node({
      tagName: 'section',
      styles: {
        'background-image': backgroundImage,
        'background-color': 'rgb(17, 34, 51)',
      },
    }));

    expect(result.type).toBe('FRAME');
    expect(result.fills).toEqual([
      { type: 'SOLID', color: { r: 0.067, g: 0.133, b: 0.2, a: 1 } },
    ]);
    expect(result.fills).not.toContainEqual(expect.objectContaining({ type: 'IMAGE' }));
  });

  test('preserves complete inline SVG markup with graphical attributes in the Figma node', () => {
    const result = transformExtractionNode(node({
      tagName: 'svg',
      attributes: { viewBox: '0 0 24 24', role: 'img' },
      children: [node({ id: 'node-path', tagName: 'path' })],
      svg: '<svg viewBox="0 0 24 24" role="img"><path d="M2 3L18 21" fill="#123456"></path><circle cx="12" cy="12" r="8" fill="none"></circle></svg>',
    }));

    expect(result).toMatchObject({
      type: 'FRAME',
      svg: '<svg viewBox="0 0 24 24" role="img"><path d="M2 3L18 21" fill="#123456"></path><circle cx="12" cy="12" r="8" fill="none"></circle></svg>',
    });
  });

  test('normalizes ineffective flex spacing and omitted padding to zero', () => {
    const result = transformExtractionNode(node({
      styles: {
        display: 'flex',
        'flex-direction': 'row',
        'column-gap': 'normal',
        'padding-top': '0px',
        'padding-left': 'invalid',
      },
    }));

    expect(result.layoutMode).toBe('HORIZONTAL');
    expect(result.itemSpacing).toBe(0);
    expect(result.gap).toBe(0);
    expect(result.padding).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
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

  test('omits the root relative rect and positions descendants by directly subtracting represented rect origins', () => {
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
      x: 30, y: 40, width: 100, height: 50, top: 40, left: 30,
    });
    expect(result.children[0]?.children[0]?.relativeRect).toEqual({
      x: 10, y: 10, width: 20, height: 10, top: 10, left: 10,
    });
  });

  const relativeRectCases: Array<{
    description: string;
    childStyles: Record<string, string>;
    childRect: { x: number; y: number; width: number; height: number; top: number; left: number };
    expected: { x: number; y: number; width: number; height: number; top: number; left: number };
  }> = [
    {
      description: 'a child with a negative margin',
      childStyles: { 'margin-left': '-48px', 'margin-top': '-24px' },
      childRect: { x: 72, y: 224, width: 80, height: 40, top: 224, left: 72 },
      expected: { x: -28, y: 24, width: 80, height: 40, top: 24, left: -28 },
    },
    {
      description: 'a sticky child',
      childStyles: { position: 'sticky', top: '12px', left: '8px' },
      childRect: { x: 180, y: 165, width: 60, height: 30, top: 165, left: 180 },
      expected: { x: 80, y: -35, width: 60, height: 30, top: -35, left: 80 },
    },
    {
      description: 'a child with a zero-sized box',
      childStyles: {},
      childRect: { x: 100, y: 200, width: 0, height: 0, top: 200, left: 100 },
      expected: { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0 },
    },
  ];

  test.each(relativeRectCases)('calculates relativeRect by direct subtraction for $description', ({ childStyles, childRect, expected }) => {
    const result = transformExtractionNode(node({
      id: 'node-parent',
      layout: { rect: { x: 100, y: 200, width: 400, height: 300, top: 200, left: 100 } },
      styles: {
        'padding-left': '32px',
        'padding-top': '16px',
        'border-left-width': '4px',
        'border-top-width': '2px',
      },
      children: [node({
        id: 'node-child',
        layout: { rect: childRect },
        styles: childStyles,
      })],
    }));

    expect(result.children[0]?.relativeRect).toEqual(expected);
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
    ['div', null, [], { 'background-image': 'url("https://example.com/background.png")' }, 'FRAME'],
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

  test('associates detected font URLs only with their used text family and weight', () => {
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
      fontFaceSources: [
        { family: 'Inter', weight: 700, url: 'https://example.com/fonts/inter-bold.woff2' },
        { family: 'Unused', weight: 400, url: 'https://example.com/fonts/unused.woff2' },
      ],
      document: node({
        id: 'node-root',
        tagName: 'html',
        layout: visibleBox,
        children: [node({
          id: 'node-inter-bold',
          tagName: 'span',
          text: 'Bold',
          layout: visibleBox,
          styles: { ...typography, 'font-family': 'Inter, sans-serif', 'font-weight': '700' },
        })],
      }),
    };

    expect(transformExtractionDocument(extraction).assets).toEqual([
      { family: 'Inter', weights: [700], url: 'https://example.com/fonts/inter-bold.woff2' },
    ]);
  });

  test('emits URLs only for visible included text and retains URL-less used font assets', () => {
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
      fontFaceSources: [
        { family: 'Visible Font', weight: 400, url: 'https://example.com/fonts/visible.woff2' },
        { family: 'Hidden Font', weight: 400, url: 'https://example.com/fonts/hidden.woff2' },
        { family: 'Excluded Font', weight: 400, url: 'https://example.com/fonts/excluded.woff2' },
      ],
      document: node({
        id: 'node-root',
        tagName: 'html',
        layout: visibleBox,
        children: [
          node({
            id: 'node-visible', tagName: 'span', text: 'Visible', layout: visibleBox,
            styles: { ...typography, 'font-family': 'Visible Font', 'font-weight': '400' },
          }),
          node({
            id: 'node-undetermined', tagName: 'span', text: 'No source', layout: visibleBox,
            styles: { ...typography, 'font-family': 'Undetermined Font', 'font-weight': '400' },
          }),
          node({
            id: 'node-hidden', tagName: 'span', text: 'Hidden', layout: visibleBox,
            styles: { ...typography, 'font-family': 'Hidden Font', 'font-weight': '400', display: 'none' },
          }),
          node({
            id: 'node-excluded', tagName: 'style', text: 'Excluded', layout: visibleBox,
            styles: { ...typography, 'font-family': 'Excluded Font', 'font-weight': '400' },
          }),
        ],
      }),
    };

    expect(transformExtractionDocument(extraction).assets).toEqual([
      { family: 'Undetermined Font', weights: [400] },
      { family: 'Visible Font', weights: [400], url: 'https://example.com/fonts/visible.woff2' },
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
      schemaVersion: '1.1',
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
