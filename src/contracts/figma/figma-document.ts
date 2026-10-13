import type { ResourceReference, Viewport } from '../extraction/extraction-document.js';

export type FigmaSchemaVersion = '1.0';

export interface FigmaRect {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  left: number;
}

export interface FigmaRelativeRect extends FigmaRect {}

export type FigmaIsVisible = boolean;

export type FigmaNodeType = 'FRAME' | 'TEXT' | 'IMAGE';

export type ColorStyleId = `color-${string}`;

export type TypographyStyleId = `type-${string}`;

export interface FigmaRgbaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface ColorStyle {
  id: ColorStyleId;
  name: string;
  rgba: FigmaRgbaColor;
}

export interface TypographyStyle {
  id: TypographyStyleId;
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  fontStyle: string;
  lineHeight: string;
  letterSpacing: string;
  textTransform: string;
}

export interface FigmaStyleCatalog {
  colors: ColorStyle[];
  typographies: TypographyStyle[];
}

export type FigmaStyleValue = string | number | boolean | FigmaRgbaColor;

export interface FigmaNode {
  id: string;
  tag: string;
  type: FigmaNodeType;
  rect: FigmaRect;
  relativeRect?: FigmaRelativeRect;
  isVisible: FigmaIsVisible;
  children: FigmaNode[];
}

export interface FigmaSource {
  url: string;
  viewport: Viewport;
}

export interface FigmaDocument {
  schemaVersion: FigmaSchemaVersion;
  source: FigmaSource;
  styles: FigmaStyleCatalog;
  document: FigmaNode;
}
