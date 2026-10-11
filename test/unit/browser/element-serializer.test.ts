import { describe, expect, test } from 'vitest';

import { serializeElement } from '../../../src/browser/element-serializer.js';

interface ElementFixture {
  tagName: string;
  children: ElementFixture[];
  innerText?: string;
  hasAttribute(name: string): boolean;
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
});
