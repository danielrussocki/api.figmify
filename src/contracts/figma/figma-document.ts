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
  /** Each channel is normalized to the inclusive range from 0 to 1. */
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface FigmaSolidPaint {
  type: 'SOLID';
  color: FigmaRgbaColor;
}

export type FigmaPaint = FigmaSolidPaint;

export type FigmaFills = FigmaPaint[] | null;

export interface FigmaStroke extends FigmaSolidPaint {
  weight: number;
}

export type FigmaStrokes = FigmaStroke[] | null;

export interface FigmaEffectOffset {
  x: number;
  y: number;
}

export interface FigmaDropShadowEffect {
  type: 'DROP_SHADOW';
  color: FigmaRgbaColor;
  offset: FigmaEffectOffset;
  radius: number;
  spread: number;
}

export type FigmaEffect = FigmaDropShadowEffect;

export interface FigmaCornerRadii {
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
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

export type FigmaTextAlign = 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';

export type FigmaTextAutoResize = 'NONE' | 'WIDTH_AND_HEIGHT' | 'HEIGHT' | 'TRUNCATE';

/** Normalized typography values emitted for an individual TEXT run. */
export interface FigmaTextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  letterSpacing: number;
  textAlign: FigmaTextAlign;
  textAutoResize: FigmaTextAutoResize;
}

/** Rendered source data preserved for an IMAGE node. */
export interface FigmaImageData {
  src: string;
  naturalWidth: number;
  naturalHeight: number;
  objectFit: string;
}

/** A font family used by included text runs, optionally linked to its source. */
export interface FigmaFontAsset {
  family: string;
  weights: number[];
  url?: string;
}

export interface FigmaNode {
  id: string;
  tag: string;
  type: FigmaNodeType;
  rect: FigmaRect;
  relativeRect?: FigmaRelativeRect;
  isVisible: FigmaIsVisible;
  fills?: FigmaFills;
  strokes?: FigmaStrokes;
  effects?: FigmaEffect[] | null;
  cornerRadius?: number;
  cornerRadii?: FigmaCornerRadii;
  characters?: string;
  styles?: FigmaTextStyle;
  image?: FigmaImageData;
  svg?: string;
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
  assets: FigmaFontAsset[];
  document: FigmaNode;
}
