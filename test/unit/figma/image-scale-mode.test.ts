import { describe, expect, test } from 'vitest';

import type { ExtractionNode } from '../../../src/contracts/extraction/extraction-document.js';
import type { FigmaImageScaleMode } from '../../../src/contracts/figma/figma-document.js';
import {
  resolveBackgroundImageScaleMode,
  resolveImageScaleMode,
  transformExtractionNode,
} from '../../../src/figma/transformer.js';

const ALLOWED_SCALE_MODES = new Set<FigmaImageScaleMode>(['FILL', 'FIT', 'CROP', 'TILE']);
const BACKGROUND_IMAGE = 'url("https://example.com/background.png")';

function imageNode(objectFit: string): ExtractionNode {
  return {
    id: `image-${objectFit}`,
    tagName: 'img',
    attributes: {},
    resources: [{ kind: 'image', url: 'https://example.com/image.png' }],
    text: null,
    styles: {},
    layout: {
      rect: { x: 0, y: 0, width: 120, height: 80, top: 0, left: 0 },
      naturalWidth: 240,
      naturalHeight: 160,
      objectFit,
    },
    pseudoElements: { before: null, after: null },
    children: [],
  };
}

describe('image scale mode resolvers', () => {
  test.each([
    ['cover', 'FILL'],
    ['fill', 'FILL'],
    ['contain', 'FIT'],
    ['scale-down', 'FIT'],
    ['none', 'CROP'],
  ] as const)('resolves object-fit %s as %s', (objectFit, expected) => {
    expect(resolveImageScaleMode(objectFit)).toBe(expected);
  });

  test.each([
    ['cover without repetition', 'FILL', { 'background-size': 'cover', 'background-repeat': 'no-repeat' }],
    ['contain without repetition', 'FIT', { 'background-size': 'contain', 'background-repeat': 'no-repeat' }],
    ['automatic size without repetition', 'CROP', { 'background-size': 'auto', 'background-repeat': 'no-repeat' }],
    ['explicit size without repetition', 'CROP', { 'background-size': '160px 80px', 'background-repeat': 'no-repeat' }],
    ['horizontal repetition', 'TILE', { 'background-size': 'cover', 'background-repeat': 'repeat-x' }],
    ['vertical repetition', 'TILE', { 'background-size': 'contain', 'background-repeat': 'repeat-y' }],
    ['two-axis repetition', 'TILE', { 'background-size': 'auto', 'background-repeat': 'repeat' }],
  ] as const)('resolves %s as %s', (_, expected, styles) => {
    expect(resolveBackgroundImageScaleMode(styles)).toBe(expected);
  });

  test('emits only allowed scale modes for determinable image paints', () => {
    const imagePaints = ['cover', 'fill', 'contain', 'scale-down', 'none'].map((objectFit) =>
      transformExtractionNode(imageNode(objectFit)).fills[0],
    );
    const backgroundPaints = [
      { 'background-size': 'cover', 'background-repeat': 'no-repeat' },
      { 'background-size': 'contain', 'background-repeat': 'no-repeat' },
      { 'background-size': 'auto', 'background-repeat': 'no-repeat' },
      { 'background-size': '16px 12px', 'background-repeat': 'repeat-x' },
    ].map((styles) => transformExtractionNode({
      id: `background-${styles['background-size']}`,
      tagName: 'div',
      attributes: {},
      resources: [],
      text: null,
      styles: { 'background-image': BACKGROUND_IMAGE, ...styles },
      pseudoElements: { before: null, after: null },
      children: [],
    }).fills[0]);

    for (const paint of [...imagePaints, ...backgroundPaints]) {
      expect(paint).toMatchObject({ type: 'IMAGE' });
      if (paint?.type === 'IMAGE') {
        expect(ALLOWED_SCALE_MODES.has(paint.scaleMode)).toBe(true);
      }
    }
  });
});
