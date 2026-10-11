import type { ExtractionNode } from '../contracts/extraction/extraction-document.js';
import type { ColorStyle, FigmaRgbaColor, TypographyStyle } from '../contracts/figma/figma-document.js';

const COLOR_PROPERTIES = [
  'color',
  'background-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'outline-color',
  'text-decoration-color',
] as const;

const COLOR_EXCLUSION_PROPERTIES = {
  'background-image': (value: string) => value.trim().toLowerCase() !== 'none',
  filter: (value: string) => value.trim().toLowerCase() !== 'none',
  'mix-blend-mode': (value: string) => value.trim().toLowerCase() !== 'normal',
} as const;

const TYPOGRAPHY_PROPERTIES = [
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'line-height',
  'letter-spacing',
  'text-transform',
] as const;

/**
 * Collects reusable solid colors from an extraction tree. Style IDs derive from
 * normalized RGBA values, rather than traversal position, so they are stable.
 */
export function createColorStyleCatalog(root: ExtractionNode): ColorStyle[] {
  const colors = new Map<string, ColorStyle>();

  const visit = (node: ExtractionNode): void => {
    if (!hasColorStyleExclusion(node.styles)) {
      for (const property of COLOR_PROPERTIES) {
        const rgba = parseSolidColor(node.styles[property]);

        if (rgba === null) {
          continue;
        }

        const key = rgbaKey(rgba);
        if (!colors.has(key)) {
          colors.set(key, createColorStyle(rgba));
        }
      }
    }

    for (const child of node.children) {
      visit(child);
    }

    for (const child of node.shadowChildren ?? []) {
      visit(child);
    }
  };

  visit(root);

  return [...colors.values()].sort((left, right) => left.id.localeCompare(right.id));
}

/**
 * Collects reusable typography styles from complete computed typography tuples.
 * IDs derive from normalized values and therefore do not depend on tree order.
 */
export function createTypographyStyleCatalog(root: ExtractionNode): TypographyStyle[] {
  const typographies = new Map<string, TypographyStyle>();

  const visit = (node: ExtractionNode): void => {
    const typography = readTypographyStyle(node.styles);
    if (typography !== null) {
      const key = typographyKey(typography);
      if (!typographies.has(key)) {
        typographies.set(key, createTypographyStyle(typography));
      }
    }

    for (const child of node.children) {
      visit(child);
    }

    for (const child of node.shadowChildren ?? []) {
      visit(child);
    }
  };

  visit(root);

  return [...typographies.values()].sort((left, right) => left.id.localeCompare(right.id));
}

function readTypographyStyle(styles: Record<string, string>): Omit<TypographyStyle, 'id'> | null {
  const values = TYPOGRAPHY_PROPERTIES.map((property) => styles[property]?.trim());
  if (values.some((value) => value === undefined || value.length === 0)) {
    return null;
  }

  const [fontFamily, fontSize, fontWeight, fontStyle, lineHeight, letterSpacing, textTransform] = values as [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
  ];

  return { fontFamily, fontSize, fontWeight, fontStyle, lineHeight, letterSpacing, textTransform };
}

function typographyKey(typography: Omit<TypographyStyle, 'id'>): string {
  return [
    typography.fontFamily,
    typography.fontSize,
    typography.fontWeight,
    typography.fontStyle,
    typography.lineHeight,
    typography.letterSpacing,
    typography.textTransform,
  ].join('\u0000');
}

function createTypographyStyle(typography: Omit<TypographyStyle, 'id'>): TypographyStyle {
  const idSegments = [
    primaryFontFamily(typography.fontFamily),
    normalizeTypographyValue(typography.fontSize),
    normalizeTypographyValue(typography.fontWeight),
    normalizeTypographyValue(typography.fontStyle),
    normalizeTypographyValue(typography.lineHeight),
    normalizeLetterSpacing(typography.letterSpacing),
    normalizeTypographyValue(typography.textTransform),
  ];

  return {
    id: `type-${idSegments.join('-')}`,
    ...typography,
  };
}

function primaryFontFamily(fontFamily: string): string {
  return normalizeTypographyValue(fontFamily.split(',', 1)[0]?.replace(/["']/g, '') ?? '');
}

function normalizeLetterSpacing(value: string): string {
  return value.trim().toLowerCase() === 'normal' ? '0' : normalizeTypographyValue(value);
}

function normalizeTypographyValue(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/px$/u, '')
    .replace(/[^a-z0-9.]+/gu, '-')
    .replace(/^-+|-+$/gu, '') || 'default';
}

function hasColorStyleExclusion(styles: Record<string, string>): boolean {
  return Object.entries(COLOR_EXCLUSION_PROPERTIES).some(([property, excludes]) => {
    const value = styles[property];
    return value !== undefined && excludes(value);
  });
}

function parseSolidColor(value: string | undefined): FigmaRgbaColor | null {
  if (value === undefined) {
    return null;
  }

  const color = value.trim().toLowerCase();
  if (color === 'transparent') {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  const hex = parseHexColor(color);
  if (hex !== null) {
    return hex;
  }

  return parseRgbColor(color);
}

function parseHexColor(value: string): FigmaRgbaColor | null {
  const match = /^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.exec(value);
  if (match?.[1] === undefined) {
    return null;
  }

  const hex = match[1];
  const expanded = hex.length <= 4 ? [...hex].map((character) => character.repeat(2)).join('') : hex;
  const alpha = expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) / 255 : 1;

  return normalizeRgba({
    r: Number.parseInt(expanded.slice(0, 2), 16) / 255,
    g: Number.parseInt(expanded.slice(2, 4), 16) / 255,
    b: Number.parseInt(expanded.slice(4, 6), 16) / 255,
    a: alpha,
  });
}

function parseRgbColor(value: string): FigmaRgbaColor | null {
  const match = /^rgba?\(\s*(.+)\s*\)$/i.exec(value);
  if (match?.[1] === undefined) {
    return null;
  }

  const parts = match[1].replace(/\s*\/\s*/, ',').split(/\s*,\s*|\s+/).filter(Boolean);
  if (parts.length !== 3 && parts.length !== 4) {
    return null;
  }

  const red = parseRgbComponent(parts[0]);
  const green = parseRgbComponent(parts[1]);
  const blue = parseRgbComponent(parts[2]);
  const alpha = parts.length === 4 ? parseAlphaComponent(parts[3]) : 1;

  if (red === null || green === null || blue === null || alpha === null) {
    return null;
  }

  return normalizeRgba({ r: red / 255, g: green / 255, b: blue / 255, a: alpha });
}

function parseRgbComponent(value: string | undefined): number | null {
  if (value === undefined) {
    return null;
  }

  const component = value.endsWith('%')
    ? Number.parseFloat(value.slice(0, -1)) * 2.55
    : Number.parseFloat(value);

  return Number.isFinite(component) && component >= 0 && component <= 255 ? component : null;
}

function parseAlphaComponent(value: string | undefined): number | null {
  if (value === undefined) {
    return null;
  }

  const alpha = value.endsWith('%') ? Number.parseFloat(value.slice(0, -1)) / 100 : Number.parseFloat(value);
  return Number.isFinite(alpha) && alpha >= 0 && alpha <= 1 ? alpha : null;
}

function normalizeRgba(rgba: FigmaRgbaColor): FigmaRgbaColor {
  return {
    r: roundColorComponent(rgba.r),
    g: roundColorComponent(rgba.g),
    b: roundColorComponent(rgba.b),
    a: roundColorComponent(rgba.a),
  };
}

function roundColorComponent(value: number): number {
  return Number(value.toFixed(3));
}

function rgbaKey(rgba: FigmaRgbaColor): string {
  return `${rgba.r},${rgba.g},${rgba.b},${rgba.a}`;
}

function createColorStyle(rgba: FigmaRgbaColor): ColorStyle {
  const red = componentToHex(rgba.r);
  const green = componentToHex(rgba.g);
  const blue = componentToHex(rgba.b);
  const alpha = componentToHex(rgba.a);
  const opaque = rgba.a === 1;
  const hex = `#${red}${green}${blue}`;

  return {
    id: `color-${red}${green}${blue}${opaque ? '' : `-${alpha}`}`,
    name: opaque ? hex : `${hex} / ${Math.round(rgba.a * 100)}%`,
    rgba,
  };
}

function componentToHex(component: number): string {
  return Math.round(component * 255).toString(16).padStart(2, '0');
}
