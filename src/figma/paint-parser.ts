import type {
  FigmaCornerRadii,
  FigmaEffect,
  FigmaFills,
  FigmaRgbaColor,
  FigmaStrokes,
  FigmaStrokeWeights,
} from '../contracts/figma/figma-document.js';

export interface FigmaPaintProperties {
  fills: FigmaFills;
  strokes: FigmaStrokes;
  strokeWeight?: number;
  strokeWeights?: FigmaStrokeWeights;
  effects: FigmaEffect[] | null;
  cornerRadius?: number;
  cornerRadii?: FigmaCornerRadii;
}

/** Converts the supported computed CSS paint values to structured Figma values. */
export function parseFigmaPaints(styles: Record<string, string>): FigmaPaintProperties {
  const backgroundFill = perceptibleColor(styles['background-color']);
  const textFill = perceptibleColor(styles.color);
  const fills = backgroundFill ?? textFill;
  const radii = parseCornerRadii(styles);
  const strokes = parseStrokes(styles);

  return {
    fills: fills === null ? null : [{ type: 'SOLID', color: fills }],
    ...strokes,
    effects: parseEffects(styles),
    ...radii,
  };
}

function parseStrokes(styles: Record<string, string>): Pick<FigmaPaintProperties, 'strokes' | 'strokeWeight' | 'strokeWeights'> {
  const sides = ['top', 'right', 'bottom', 'left'] as const;
  const strokes = sides.flatMap((side) => {
    const style = styles[`border-${side}-style`]?.trim().toLowerCase();
    const weight = cssNumber(styles[`border-${side}-width`]);
    const color = perceptibleColor(styles[`border-${side}-color`]);
    if (style === undefined || style === 'none' || style === 'hidden' || weight === undefined || weight <= 0 || color === null) {
      return [];
    }

    return [{ type: 'SOLID' as const, side: side.toUpperCase() as Uppercase<typeof side>, weight, color }];
  });

  if (strokes.length === 0) return { strokes: null };
  if (!isUniformStroke(strokes)) {
    const [top, right, bottom, left] = sides.map((side) => cssNumber(styles[`border-${side}-width`]));
    return top === undefined || right === undefined || bottom === undefined || left === undefined
      ? { strokes: strokes.map(({ side: _side, ...stroke }) => stroke) }
      : { strokes, strokeWeights: { top, right, bottom, left } };
  }

  return {
    strokes: [{ type: 'SOLID', weight: strokes[0]!.weight, color: strokes[0]!.color }],
    strokeWeight: strokes[0]!.weight,
  };
}

function isUniformStroke(strokes: NonNullable<FigmaStrokes>): boolean {
  if (strokes.length !== 4) return false;

  const first = strokes[0]!;
  return strokes.every((stroke) => stroke.weight === first.weight
    && stroke.color.r === first.color.r
    && stroke.color.g === first.color.g
    && stroke.color.b === first.color.b
    && stroke.color.a === first.color.a);
}

function parseEffects(styles: Record<string, string>): FigmaEffect[] | null {
  const effects = [styles['box-shadow'], styles['text-shadow']]
    .flatMap((value) => parseShadows(value));
  return effects.length === 0 ? null : effects;
}

function parseShadows(value: string | undefined): FigmaEffect[] {
  if (value === undefined || value.trim().toLowerCase() === 'none') return [];

  return splitCssList(value).flatMap((shadow) => {
    const normalized = shadow.trim();
    if (normalized.length === 0) return [];
    const isInset = /\binset\b/iu.test(normalized);

    const colorMatch = /(?:rgba?\([^)]*\)|#[\da-f]{3,8}|\btransparent\b)/iu.exec(normalized);
    if (colorMatch === null) return [];

    const color = perceptibleColor(colorMatch[0]);
    if (color === null) return [];

    const dimensions = (normalized.slice(0, colorMatch.index) + normalized.slice((colorMatch.index ?? 0) + colorMatch[0].length))
      .replace(/\binset\b/giu, ' ');
    const values = dimensions.trim().split(/\s+/u).filter(Boolean).map(cssNumber);
    if (values.length < 2 || values.length > 4 || values.some((number) => number === undefined)) return [];

    const x = values[0]!;
    const y = values[1]!;
    const radius = values[2] ?? 0;
    const spread = values[3] ?? 0;
    return [{ type: isInset ? 'INNER_SHADOW' as const : 'DROP_SHADOW' as const, color, offset: { x, y }, radius, spread }];
  });
}

function parseCornerRadii(styles: Record<string, string>): Pick<FigmaPaintProperties, 'cornerRadius' | 'cornerRadii'> {
  const values = [
    cssNumber(styles['border-top-left-radius']),
    cssNumber(styles['border-top-right-radius']),
    cssNumber(styles['border-bottom-right-radius']),
    cssNumber(styles['border-bottom-left-radius']),
  ];
  if (values.some((value) => value === undefined)) return {};

  const topLeft = values[0]!;
  const topRight = values[1]!;
  const bottomRight = values[2]!;
  const bottomLeft = values[3]!;
  if (topLeft < 0 || topRight < 0 || bottomRight < 0 || bottomLeft < 0 || values.every((value) => value === 0)) return {};
  if (topLeft === topRight && topLeft === bottomRight && topLeft === bottomLeft) return { cornerRadius: topLeft };

  return { cornerRadii: { topLeft, topRight, bottomRight, bottomLeft } };
}

function perceptibleColor(value: string | undefined): FigmaRgbaColor | null {
  const color = parseSolidColor(value);
  return color === null || color.a <= 0 ? null : color;
}

function parseSolidColor(value: string | undefined): FigmaRgbaColor | null {
  if (value === undefined) return null;
  const color = value.trim().toLowerCase();
  if (color === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };

  const hex = /^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/iu.exec(color)?.[1];
  if (hex !== undefined) {
    const expanded = hex.length <= 4 ? [...hex].map((part) => part.repeat(2)).join('') : hex;
    return normalizeRgba({
      r: Number.parseInt(expanded.slice(0, 2), 16) / 255,
      g: Number.parseInt(expanded.slice(2, 4), 16) / 255,
      b: Number.parseInt(expanded.slice(4, 6), 16) / 255,
      a: expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) / 255 : 1,
    });
  }

  const contents = /^rgba?\(\s*(.+)\s*\)$/iu.exec(color)?.[1];
  if (contents === undefined) return null;
  const parts = contents.replace(/\s*\/\s*/u, ',').split(/\s*,\s*|\s+/u).filter(Boolean);
  if (parts.length !== 3 && parts.length !== 4) return null;
  const channels = parts.slice(0, 3).map(parseRgbComponent);
  const alpha = parts.length === 4 ? parseAlphaComponent(parts[3]) : 1;
  if (channels.some((channel) => channel === null) || alpha === null) return null;

  return normalizeRgba({ r: channels[0]! / 255, g: channels[1]! / 255, b: channels[2]! / 255, a: alpha });
}

function parseRgbComponent(value: string | undefined): number | null {
  if (value === undefined) return null;
  const component = value.endsWith('%') ? Number.parseFloat(value.slice(0, -1)) * 2.55 : Number.parseFloat(value);
  return Number.isFinite(component) && component >= 0 && component <= 255 ? component : null;
}

function parseAlphaComponent(value: string | undefined): number | null {
  if (value === undefined) return null;
  const alpha = value.endsWith('%') ? Number.parseFloat(value.slice(0, -1)) / 100 : Number.parseFloat(value);
  return Number.isFinite(alpha) && alpha >= 0 && alpha <= 1 ? alpha : null;
}

function cssNumber(value: string | undefined): number | undefined {
  const match = /^(-?(?:\d+\.?\d*|\.\d+))(?:px)?$/iu.exec(value?.trim() ?? '');
  if (match?.[1] === undefined) return undefined;
  const number = Number(match[1]);
  return Number.isFinite(number) ? number : undefined;
}

function splitCssList(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === '(') depth += 1;
    if (value[index] === ')') depth -= 1;
    if (value[index] === ',' && depth === 0) {
      parts.push(value.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(value.slice(start));
  return parts;
}

function normalizeRgba(rgba: FigmaRgbaColor): FigmaRgbaColor {
  return {
    r: roundComponent(rgba.r),
    g: roundComponent(rgba.g),
    b: roundComponent(rgba.b),
    a: roundComponent(rgba.a),
  };
}

function roundComponent(value: number): number {
  return Number(value.toFixed(3));
}
