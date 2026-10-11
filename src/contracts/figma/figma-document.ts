import type { ResourceReference, Viewport } from '../extraction/extraction-document.js';

export type FigmaSchemaVersion = '1.0';

export type FigmaNodeType = 'DOCUMENT' | 'FRAME' | 'TEXT' | 'IMAGE' | 'VECTOR' | 'RECTANGLE';

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
  sourceId: string;
  type: FigmaNodeType;
  name: string;
  characters?: string;
  attributes: Record<string, string>;
  resources: ResourceReference[];
  fillStyleId?: ColorStyleId;
  textStyleId?: TypographyStyleId;
  styles: Record<string, FigmaStyleValue>;
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
