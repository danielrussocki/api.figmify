import { describe, expect, test } from 'vitest';

import type { FigmaNode } from '../../../src/contracts/figma/figma-document.js';
import { collectUsedFontAssets } from '../../../src/figma/font-assets.js';

function node(overrides: Partial<FigmaNode> = {}): FigmaNode {
  return {
    id: 'node-1',
    tag: 'div',
    type: 'FRAME',
    rect: { x: 0, y: 0, width: 1, height: 1, top: 0, left: 0 },
    isVisible: true,
    children: [],
    ...overrides,
  };
}

describe('collectUsedFontAssets', () => {
  test('groups visible text families and weights, and uses a determinable source URL', () => {
    const document = node({
      children: [
        node({
          id: 'node-inter-regular',
          tag: 'span',
          type: 'TEXT',
          styles: {
            fontFamily: 'Inter', fontSize: 16, fontWeight: 400, lineHeight: 24,
            letterSpacing: 0, textAlign: 'LEFT', textAutoResize: 'HEIGHT',
          },
        }),
        node({
          id: 'node-inter-bold',
          tag: 'strong',
          type: 'TEXT',
          styles: {
            fontFamily: 'Inter', fontSize: 16, fontWeight: 700, lineHeight: 24,
            letterSpacing: 0, textAlign: 'LEFT', textAutoResize: 'HEIGHT',
          },
        }),
        node({
          id: 'node-hidden',
          tag: 'span',
          type: 'TEXT',
          isVisible: false,
          styles: {
            fontFamily: 'Roboto', fontSize: 16, fontWeight: 500, lineHeight: 24,
            letterSpacing: 0, textAlign: 'LEFT', textAutoResize: 'HEIGHT',
          },
        }),
      ],
    });

    expect(collectUsedFontAssets(document, new Map([
      ['Inter', 'https://example.com/inter.woff2'],
    ]))).toEqual([
      { family: 'Inter', weights: [400, 700], url: 'https://example.com/inter.woff2' },
    ]);
  });
});
