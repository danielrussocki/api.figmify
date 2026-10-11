import { describe, expect, test } from 'vitest';

import { serializeElement } from '../../../src/browser/element-serializer.js';

interface ElementFixture {
  tagName: string;
  children: ElementFixture[];
  shadowRoot?: { children: ElementFixture[] } | null;
  innerText?: string;
  hasAttribute(name: string): boolean;
  ownerDocument?: {
    defaultView?: {
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
  return {
    tagName,
    children,
    shadowRoot: null,
    innerText,
    hasAttribute: (name) => hidden && name === 'hidden',
  };
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
      styles: {},
      pseudoElements: { before: null, after: null },
      children: [],
    });
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
