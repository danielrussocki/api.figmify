import { describe, expect, test } from 'vitest';

import { parseFigmaPaints } from '../../../src/figma/paint-parser.js';

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
