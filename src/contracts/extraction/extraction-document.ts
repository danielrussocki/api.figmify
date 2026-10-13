export type SchemaVersion = '1.0';

export interface Viewport {
  width: number;
  height: number;
  deviceScaleFactor: 1 | 2 | 3;
}

export interface RenderingEnvironment {
  locale: string;
  timezone: string;
  colorScheme: 'light';
  reducedMotion: 'no-preference';
}

export interface ResourceReference {
  kind: 'image' | 'media' | 'stylesheet';
  url: string;
}

export interface PseudoElement {
  content: string | null;
  styles: Record<string, string>;
}

export interface PseudoElements {
  before: PseudoElement | null;
  after: PseudoElement | null;
}

/** A document-coordinate rectangle expressed in CSS pixels. */
export interface DocumentRect {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  left: number;
}

export type ObjectFit = 'fill' | 'contain' | 'cover' | 'none' | 'scale-down';

/**
 * Browser measurements retained separately from textual computed styles for
 * later Figma transformations. Layout extraction is introduced incrementally,
 * so the metadata is absent from documents produced by older serializers.
 */
export interface ExtractionLayout {
  rect: DocumentRect;
  offsetParentId?: string;
  hasOffsetParent?: boolean;
  naturalWidth?: number;
  naturalHeight?: number;
  objectFit?: ObjectFit;
}

export interface ExtractionNode {
  id: string;
  tagName: string;
  attributes: Record<string, string>;
  resources: ResourceReference[];
  text: string | null;
  layout?: ExtractionLayout;
  styles: Record<string, string>;
  pseudoElements: PseudoElements;
  children: ExtractionNode[];
  shadowChildren?: ExtractionNode[];
}

export interface ExtractionSource {
  url: string;
  viewport: Viewport;
  environment: RenderingEnvironment;
}

export interface ExtractionDocument {
  schemaVersion: SchemaVersion;
  source: ExtractionSource;
  document: ExtractionNode;
}
