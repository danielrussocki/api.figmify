import { describe, expect, test } from 'vitest';

import { serializeElement } from '../../../src/browser/element-serializer.js';

interface ElementFixture {
  tagName: string;
  children: ElementFixture[];
  childNodes?: Array<ElementFixture | { nodeType: number; textContent: string | null }>;
  shadowRoot?: { children: ElementFixture[] } | null;
  parentElement?: ElementFixture | null;
  innerText?: string;
  offsetParent?: ElementFixture | null;
  naturalWidth?: number;
  naturalHeight?: number;
  getBoundingClientRect?: () => {
    x: number;
    y: number;
    width: number;
    height: number;
    top: number;
    left: number;
  };
  hasAttribute(name: string): boolean;
  ownerDocument?: {
      defaultView?: {
        scrollX?: number;
        scrollY?: number;
        getComputedStyle(element: Element, pseudoElement?: string): {
        getPropertyValue(property: string): unknown;
        display?: string;
        visibility?: string;
      };
    };
  };
}

function element(
  tagName: string,
  children: ElementFixture[] = [],
  innerText?: string,
  hidden = false,
): ElementFixture {
  const fixture: ElementFixture = {
    tagName,
    children,
    shadowRoot: null,
    innerText,
    hasAttribute: (name) => hidden && name === 'hidden',
  };
  for (const child of children) {
    child.parentElement = fixture;
  }

  return fixture;
}

describe('serializeElement', () => {
  test('serializes an element tree in DOM child order with unique internal IDs', () => {
    const root = element('MAIN', [
      element('HEADER'),
      element('SECTION', [element('H1'), element('P')]),
      element('FOOTER'),
    ]);

    const serialized = serializeElement(root as unknown as Element);

    expect(serialized).toMatchObject({
      id: 'node-1',
      tagName: 'main',
      children: [
        { id: 'node-2', tagName: 'header', children: [] },
        {
          id: 'node-3',
          tagName: 'section',
          children: [
            { id: 'node-4', tagName: 'h1', children: [] },
            { id: 'node-5', tagName: 'p', children: [] },
          ],
        },
        { id: 'node-6', tagName: 'footer', children: [] },
      ],
    });
  });

  test('serializes open Shadow DOM children in their Shadow DOM order', () => {
    const root = element('MAIN', [element('P')]);
    const host = element('CUSTOM-CARD');
    host.shadowRoot = {
      children: [element('HEADER'), element('SECTION', [element('H2')]), element('FOOTER')],
    };
    root.children.unshift(host);

    const serialized = serializeElement(root as unknown as Element);

    expect(serialized.children[0]).toMatchObject({
      id: 'node-2',
      tagName: 'custom-card',
      children: [],
      shadowChildren: [
        { id: 'node-3', tagName: 'header', children: [] },
        {
          id: 'node-4',
          tagName: 'section',
          children: [{ id: 'node-5', tagName: 'h2', children: [] }],
        },
        { id: 'node-6', tagName: 'footer', children: [] },
      ],
    });
    expect(serialized.children[1]).toMatchObject({ id: 'node-7', tagName: 'p' });
  });

  test('does not add shadow children when a Shadow DOM root is closed', () => {
    const host = element('CUSTOM-CARD');
    host.shadowRoot = null;

    const serialized = serializeElement(host as unknown as Element);

    expect(serialized).not.toHaveProperty('shadowChildren');
  });

  test('includes the complete extraction-node shape with basic placeholder values', () => {
    const serialized = serializeElement(element('DIV') as unknown as Element);

    expect(serialized).toEqual({
      id: 'node-1',
      tagName: 'div',
      attributes: {},
      resources: [],
      text: null,
      layout: {
        rect: { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0 },
      },
      styles: {},
      pseudoElements: { before: null, after: null },
      children: [],
    });
  });

  test('converts a viewport rectangle to absolute document coordinates', () => {
    const root = element('DIV');
    root.getBoundingClientRect = () => ({
      x: 20,
      y: 30,
      width: 40,
      height: 50,
      top: 30,
      left: 20,
    });
    root.ownerDocument = {
      defaultView: {
        scrollX: 100,
        scrollY: 200,
        getComputedStyle: () => ({ getPropertyValue: () => '' }),
      },
    };

    const serialized = serializeElement(root as unknown as Element);

    expect(serialized.layout).toEqual({
      rect: { x: 120, y: 230, width: 40, height: 50, top: 230, left: 120 },
    });
  });

  test('uses six zero values when an element has no box', () => {
    const root = element('DIV');
    root.getBoundingClientRect = () => ({
      x: 20,
      y: 30,
      width: 0,
      height: 0,
      top: 30,
      left: 20,
    });

    const serialized = serializeElement(root as unknown as Element);

    expect(serialized.layout).toEqual({
      rect: { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0 },
    });
  });

  test('retains image dimensions, computed object fit, and applicable offset parent metadata', () => {
    const image = element('IMG');
    const root = element('DIV', [image]);
    image.offsetParent = root;
    image.naturalWidth = 640;
    image.naturalHeight = 480;
    image.ownerDocument = {
      defaultView: {
        getComputedStyle: () => ({
          getPropertyValue: (property) => property === 'object-fit' ? 'cover' : '',
        }),
      },
    };

    const serialized = serializeElement(root as unknown as Element);

    expect(serialized.children[0]?.layout).toEqual({
      rect: { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0 },
      hasOffsetParent: true,
      offsetParentId: 'node-1',
      naturalWidth: 640,
      naturalHeight: 480,
      objectFit: 'cover',
    });
    expect(serialized.children[0]?.styles).toEqual({ 'object-fit': 'cover' });
  });

  test('extracts rendered text and returns null when an element has no rendered text', () => {
    const root = element(
      'MAIN',
      [
        element('H1', [], 'Welcome'),
        element('P', [], '   '),
      ],
      'Welcome',
    );

    const serialized = serializeElement(root as unknown as Element);

    expect(serialized.text).toBe('Welcome');
    expect(serialized.children[0]?.text).toBe('Welcome');
    expect(serialized.children[1]?.text).toBeNull();
  });

  test('keeps hidden elements in the tree and returns null for their non-rendered text', () => {
    const root = element('MAIN', [element('P', [], 'Hidden content', true)]);

    const serialized = serializeElement(root as unknown as Element);

    expect(serialized.children).toHaveLength(1);
    expect(serialized.children[0]).toMatchObject({
      tagName: 'p',
      text: null,
    });
  });

  test('serializes rendered direct text runs in child-node order without duplicating container text', () => {
    const emphasis = element('EM', [], 'world');
    const root = element('P', [emphasis], 'Hello world again');
    root.childNodes = [
      { nodeType: 3, textContent: 'Hello ' },
      emphasis,
      { nodeType: 3, textContent: ' again' },
    ];
    root.ownerDocument = {
      defaultView: {
        getComputedStyle: () => ({
          getPropertyValue: (property) => ({
            color: 'rgb(1, 2, 3)',
            'font-size': '16px',
            'not-permitted': 'must not be serialized',
          })[property] ?? '',
        }),
      },
    };

    const serialized = serializeElement(root as unknown as Element);

    expect(serialized.text).toBeNull();
    expect(serialized.directTextRuns).toEqual([
      {
        characters: 'Hello ',
        childNodeIndex: 0,
        styles: { color: 'rgb(1, 2, 3)', 'font-size': '16px' },
      },
      {
        characters: ' again',
        childNodeIndex: 2,
        styles: { color: 'rgb(1, 2, 3)', 'font-size': '16px' },
      },
    ]);
    expect(serialized.children).toHaveLength(1);
  });

  test('omits non-rendered and whitespace-only direct text runs', () => {
    const hidden = element('P', [], 'Hidden text', true);
    hidden.childNodes = [{ nodeType: 3, textContent: 'Hidden text' }];
    const whitespace = element('P', [], '   ');
    whitespace.childNodes = [{ nodeType: 3, textContent: '   ' }];
    const root = element('MAIN', [hidden, whitespace]);

    const serialized = serializeElement(root as unknown as Element);

    expect(serialized.children[0]).not.toHaveProperty('directTextRuns');
    expect(serialized.children[0]?.text).toBeNull();
    expect(serialized.children[1]).not.toHaveProperty('directTextRuns');
    expect(serialized.children[1]?.text).toBeNull();
  });

  test('keeps mixed direct text separate from styled element text and excludes hidden text subtrees', () => {
    const emphasis = element('EM', [], 'world');
    const mixed = element('P', [emphasis], 'Hello world again');
    mixed.childNodes = [
      { nodeType: 3, textContent: 'Hello ' },
      emphasis,
      { nodeType: 3, textContent: ' again' },
    ];
    const hiddenEmphasis = element('EM', [], 'hidden child');
    const hidden = element('SECTION', [hiddenEmphasis], 'Hidden direct hidden child', true);
    hidden.childNodes = [
      { nodeType: 3, textContent: 'Hidden direct ' },
      hiddenEmphasis,
    ];
    const root = element('MAIN', [mixed, hidden]);

    const serialized = serializeElement(root as unknown as Element);

    expect(serialized.children[0]).toMatchObject({
      text: null,
      directTextRuns: [
        { characters: 'Hello ', childNodeIndex: 0 },
        { characters: ' again', childNodeIndex: 2 },
      ],
      children: [{ tagName: 'em', text: 'world' }],
    });
    expect(serialized.children[1]).toMatchObject({ text: null, children: [{ text: null }] });
    expect(serialized.children[1]).not.toHaveProperty('directTextRuns');
    expect(JSON.stringify(serialized.children[0])).toContain('Hello ');
    expect(JSON.stringify(serialized.children[0])).not.toContain('Hello world again');
  });

  test('reads only permitted computed visual properties', () => {
    const root = element('DIV');
    root.ownerDocument = {
      defaultView: {
        getComputedStyle: () => ({
          getPropertyValue: (property) => ({
            display: 'flex',
            'font-size': '16px',
            color: 'rgb(1, 2, 3)',
            'not-permitted': 'must not be serialized',
          })[property] ?? '',
        }),
      },
    };

    const serialized = serializeElement(root as unknown as Element);

    expect(serialized.styles).toEqual({
      display: 'flex',
      'font-size': '16px',
      color: 'rgb(1, 2, 3)',
    });
  });

  test('omits indeterminable and non-serializable computed values', () => {
    const root = element('DIV');
    root.ownerDocument = {
      defaultView: {
        getComputedStyle: () => ({
          getPropertyValue: (property) => ({
            display: 'block',
            position: '',
            opacity: undefined,
            color: { value: 'red' },
          })[property],
        }),
      },
    };

    const serialized = serializeElement(root as unknown as Element);

    expect(serialized.styles).toEqual({ display: 'block' });
  });

  test('serializes computed ::before and ::after content with only permitted visual styles', () => {
    const root = element('DIV');
    root.ownerDocument = {
      defaultView: {
        getComputedStyle: (_element, pseudoElement) => {
          const values = pseudoElement === '::before'
            ? {
                content: '"Before content"',
                display: 'inline-block',
                color: 'rgb(1, 2, 3)',
                'not-permitted': 'must not be serialized',
              }
            : pseudoElement === '::after'
              ? {
                  content: '"After content"',
                  'font-size': '16px',
                  opacity: '0.5',
                }
              : {};

          return {
            getPropertyValue: (property) => values[property as keyof typeof values] ?? '',
          };
        },
      },
    };

    const serialized = serializeElement(root as unknown as Element);

    expect(serialized.pseudoElements).toEqual({
      before: {
        content: 'Before content',
        styles: {
          display: 'inline-block',
          color: 'rgb(1, 2, 3)',
        },
      },
      after: {
        content: 'After content',
        styles: {
          'font-size': '16px',
          opacity: '0.5',
        },
      },
    });
  });

  test('returns null for pseudo-elements without generated content', () => {
    const root = element('DIV');
    root.ownerDocument = {
      defaultView: {
        getComputedStyle: (_element, pseudoElement) => ({
          getPropertyValue: (property) => {
            if (property !== 'content') {
              return '';
            }

            return pseudoElement === '::before' ? 'none' : 'normal';
          },
        }),
      },
    };

    const serialized = serializeElement(root as unknown as Element);

    expect(serialized.pseudoElements).toEqual({ before: null, after: null });
  });

  test('keeps only permitted visual and semantic attributes', () => {
    const attributes = {
      id: 'hero',
      class: 'banner',
      role: 'region',
      'aria-label': 'Featured content',
      href: '/products',
      onclick: 'doNotSerialize()',
      style: 'color: red',
      'data-tracking-id': 'private',
    };
    const root = {
      ...element('A'),
      getAttributeNames: () => Object.keys(attributes),
      getAttribute: (name: string) => attributes[name as keyof typeof attributes] ?? null,
    };

    const serialized = serializeElement(root as unknown as Element);

    expect(serialized.attributes).toEqual({
      id: 'hero',
      class: 'banner',
      role: 'region',
      'aria-label': 'Featured content',
      href: '/products',
    });
  });

  test('resolves allowed resource references without treating ordinary links as resources', () => {
    const createResourceElement = (
      tagName: string,
      attributes: Record<string, string>,
    ): ElementFixture => ({
      ...element(tagName),
      baseURI: 'https://example.test/catalog/page',
      getAttributeNames: () => Object.keys(attributes),
      getAttribute: (name: string) => attributes[name] ?? null,
    } as ElementFixture);
    const root = element('DIV', [
      createResourceElement('IMG', {
        src: 'images/logo.svg',
        srcset: 'images/logo-small.svg 1x, /images/logo-large.svg 2x',
      }),
      createResourceElement('INPUT', { type: 'image', src: '/submit.png' }),
      createResourceElement('VIDEO', { poster: 'posters/intro.jpg', src: '/intro.mp4' }),
      createResourceElement('AUDIO', { src: 'audio/theme.mp3' }),
      createResourceElement('SOURCE', { src: '/media/clip.webm' }),
      createResourceElement('LINK', { rel: 'preload stylesheet', href: '/site.css' }),
      createResourceElement('A', { href: '/ordinary-link' }),
    ]);

    const serialized = serializeElement(root as unknown as Element);

    expect(serialized.children.map((child) => child.resources)).toEqual([
      [
        { kind: 'image', url: 'https://example.test/catalog/images/logo.svg' },
        { kind: 'image', url: 'https://example.test/catalog/images/logo-small.svg' },
        { kind: 'image', url: 'https://example.test/images/logo-large.svg' },
      ],
      [{ kind: 'image', url: 'https://example.test/submit.png' }],
      [
        { kind: 'media', url: 'https://example.test/catalog/posters/intro.jpg' },
        { kind: 'media', url: 'https://example.test/intro.mp4' },
      ],
      [{ kind: 'media', url: 'https://example.test/catalog/audio/theme.mp3' }],
      [{ kind: 'media', url: 'https://example.test/media/clip.webm' }],
      [{ kind: 'stylesheet', url: 'https://example.test/site.css' }],
      [],
    ]);
  });
});
