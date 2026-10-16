import { describe, expect, test } from 'vitest';

import {
  extractSingleAbsoluteBackgroundImageUrl,
  parseFigmaPaints,
} from '../../../src/figma/paint-parser.js';

describe('extractSingleAbsoluteBackgroundImageUrl', () => {
  test('extracts the source from a declaration with one absolute URL', () => {
    expect(extractSingleAbsoluteBackgroundImageUrl('url("https://example.com/images/hero.png")'))
      .toBe('https://example.com/images/hero.png');
  });

  test.each([
    ['an empty URL', 'url("")'],
    ['a relative URL', 'url("images/hero.png")'],
    ['an invalid URL', 'url("https://")'],
  ])('omits the source for %s', (_, backgroundImage) => {
    expect(extractSingleAbsoluteBackgroundImageUrl(backgroundImage)).toBeUndefined();
  });
});

describe('parseFigmaPaints', () => {
  test('normalizes perceptible solid fills and borders to RGBA', () => {
    expect(parseFigmaPaints({
      'background-color': 'rgba(255, 128, 0, 0.5)',
      'border-top-width': '2px',
      'border-top-style': 'solid',
      'border-top-color': '#1234',
      'border-right-width': '1px',
      'border-right-style': 'none',
      'border-right-color': 'rgb(0, 0, 0)',
    })).toEqual({
      fills: [{ type: 'SOLID', color: { r: 1, g: 0.502, b: 0, a: 0.5 } }],
      strokes: [{ type: 'SOLID', weight: 2, color: { r: 0.067, g: 0.133, b: 0.2, a: 0.267 } }],
      effects: null,
    });
  });

  test('uses the text color as a fill when no background fill is present', () => {
    expect(parseFigmaPaints({ color: 'rgb(17, 24, 39)' }).fills).toEqual([
      { type: 'SOLID', color: { r: 0.067, g: 0.094, b: 0.153, a: 1 } },
    ]);
  });

  test('collapses an identical perceptible solid border into one stroke and weight', () => {
    const border = {
      'border-top-width': '2px',
      'border-right-width': '2px',
      'border-bottom-width': '2px',
      'border-left-width': '2px',
      'border-top-style': 'solid',
      'border-right-style': 'solid',
      'border-bottom-style': 'solid',
      'border-left-style': 'solid',
      'border-top-color': 'rgba(17, 34, 51, 0.5)',
      'border-right-color': 'rgba(17, 34, 51, 0.5)',
      'border-bottom-color': 'rgba(17, 34, 51, 0.5)',
      'border-left-color': 'rgba(17, 34, 51, 0.5)',
    };

    expect(parseFigmaPaints(border)).toMatchObject({
      strokes: [{ type: 'SOLID', color: { r: 0.067, g: 0.133, b: 0.2, a: 0.5 } }],
      strokeWeight: 2,
    });
  });

  test('preserves distinct solid borders by physical side and retains all widths', () => {
    expect(parseFigmaPaints({
      'border-top-width': '1px',
      'border-right-width': '2px',
      'border-bottom-width': '3px',
      'border-left-width': '4px',
      'border-top-style': 'solid',
      'border-right-style': 'solid',
      'border-bottom-style': 'solid',
      'border-left-style': 'solid',
      'border-top-color': 'rgb(255, 0, 0)',
      'border-right-color': 'rgb(0, 255, 0)',
      'border-bottom-color': 'rgb(0, 0, 255)',
      'border-left-color': 'rgb(255, 255, 0)',
    })).toEqual({
      fills: null,
      strokes: [
        { type: 'SOLID', side: 'TOP', weight: 1, color: { r: 1, g: 0, b: 0, a: 1 } },
        { type: 'SOLID', side: 'RIGHT', weight: 2, color: { r: 0, g: 1, b: 0, a: 1 } },
        { type: 'SOLID', side: 'BOTTOM', weight: 3, color: { r: 0, g: 0, b: 1, a: 1 } },
        { type: 'SOLID', side: 'LEFT', weight: 4, color: { r: 1, g: 1, b: 0, a: 1 } },
      ],
      strokeWeights: { top: 1, right: 2, bottom: 3, left: 4 },
      effects: null,
    });
  });

  test('omits transparent borders even when every physical side is otherwise valid', () => {
    expect(parseFigmaPaints({
      'border-top-width': '1px',
      'border-right-width': '2px',
      'border-bottom-width': '3px',
      'border-left-width': '4px',
      'border-top-style': 'solid',
      'border-right-style': 'solid',
      'border-bottom-style': 'solid',
      'border-left-style': 'solid',
      'border-top-color': 'transparent',
      'border-right-color': 'rgba(0, 0, 0, 0)',
      'border-bottom-color': '#00000000',
      'border-left-color': '#0000',
    })).toMatchObject({ strokes: null });
  });

  test('converts perceptible CSS box shadows to DROP_SHADOW effects', () => {
    expect(parseFigmaPaints({
      'box-shadow': 'rgba(0, 0, 0, 0.25) 2px -3px 4px 1px, 0 1px 2px rgb(10, 20, 30)',
    }).effects).toEqual([
      {
        type: 'DROP_SHADOW',
        color: { r: 0, g: 0, b: 0, a: 0.25 },
        offset: { x: 2, y: -3 },
        radius: 4,
        spread: 1,
      },
      {
        type: 'DROP_SHADOW',
        color: { r: 0.039, g: 0.078, b: 0.118, a: 1 },
        offset: { x: 0, y: 1 },
        radius: 2,
        spread: 0,
      },
    ]);
  });

  test('preserves the order and inset type of perceptible CSS box shadows', () => {
    expect(parseFigmaPaints({
      'box-shadow': 'inset rgba(10, 20, 30, 0.4) 1px -2px 0 3px, 0 4px 8px #0008, inset 0 0 6px rgb(40, 50, 60)',
    }).effects).toEqual([
      {
        type: 'INNER_SHADOW',
        color: { r: 0.039, g: 0.078, b: 0.118, a: 0.4 },
        offset: { x: 1, y: -2 },
        radius: 0,
        spread: 3,
      },
      {
        type: 'DROP_SHADOW',
        color: { r: 0, g: 0, b: 0, a: 0.533 },
        offset: { x: 0, y: 4 },
        radius: 8,
        spread: 0,
      },
      {
        type: 'INNER_SHADOW',
        color: { r: 0.157, g: 0.196, b: 0.235, a: 1 },
        offset: { x: 0, y: 0 },
        radius: 6,
        spread: 0,
      },
    ]);
  });

  test('preserves zero offsets, blur, and spread for external and internal shadows', () => {
    expect(parseFigmaPaints({
      'box-shadow': '0 0 0 0 rgb(1, 2, 3), inset 0px 0px 0px 0px #040506',
    }).effects).toEqual([
      {
        type: 'DROP_SHADOW',
        color: { r: 0.004, g: 0.008, b: 0.012, a: 1 },
        offset: { x: 0, y: 0 },
        radius: 0,
        spread: 0,
      },
      {
        type: 'INNER_SHADOW',
        color: { r: 0.016, g: 0.02, b: 0.024, a: 1 },
        offset: { x: 0, y: 0 },
        radius: 0,
        spread: 0,
      },
    ]);
  });

  test('expresses uniform and per-corner radii numerically', () => {
    expect(parseFigmaPaints({
      'border-top-left-radius': '8px',
      'border-top-right-radius': '8px',
      'border-bottom-right-radius': '8px',
      'border-bottom-left-radius': '8px',
    })).toMatchObject({ cornerRadius: 8 });

    expect(parseFigmaPaints({
      'border-top-left-radius': '2px',
      'border-top-right-radius': '4px',
      'border-bottom-right-radius': '6px',
      'border-bottom-left-radius': '8px',
    })).toMatchObject({
      cornerRadii: { topLeft: 2, topRight: 4, bottomRight: 6, bottomLeft: 8 },
    });
  });

  test('represents absent, transparent, and unsupported CSS values without CSS strings', () => {
    expect(parseFigmaPaints({
      'background-color': 'transparent',
      'border-top-width': '1px',
      'border-top-style': 'solid',
      'border-top-color': 'transparent',
      'box-shadow': 'none',
      'border-top-left-radius': '50%',
    })).toEqual({ fills: null, strokes: null, effects: null });
  });
});
