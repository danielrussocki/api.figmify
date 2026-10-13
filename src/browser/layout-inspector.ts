import type { DocumentRect, ExtractionLayout } from '../contracts/extraction/extraction-document.js';

const ZERO_RECT: DocumentRect = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  top: 0,
  left: 0,
};

/** Reads an element box and expresses it in document coordinates. */
export function inspectLayout(
  element: Element,
  resolveNodeId?: (element: Element) => string | undefined,
): ExtractionLayout {
  const metadata = inspectSupplementaryLayout(element, resolveNodeId);

  try {
    const box = element.getBoundingClientRect();
    const view = element.ownerDocument?.defaultView;
    const scrollX = finiteNumber(view?.scrollX);
    const scrollY = finiteNumber(view?.scrollY);

    if (box.width === 0 && box.height === 0) {
      return { rect: { ...ZERO_RECT }, ...metadata };
    }

    const rect = {
      x: box.x + scrollX,
      y: box.y + scrollY,
      width: box.width,
      height: box.height,
      top: box.top + scrollY,
      left: box.left + scrollX,
    };

    return Object.values(rect).every(Number.isFinite)
      ? { rect, ...metadata }
      : { rect: { ...ZERO_RECT }, ...metadata };
  } catch {
    return { rect: { ...ZERO_RECT }, ...metadata };
  }
}

function inspectSupplementaryLayout(
  element: Element,
  resolveNodeId?: (element: Element) => string | undefined,
): Omit<ExtractionLayout, 'rect'> {
  const layout: Omit<ExtractionLayout, 'rect'> = {};

  if ('offsetParent' in element) {
    const offsetParent = (element as HTMLElement).offsetParent;
    layout.hasOffsetParent = offsetParent !== null;

    if (offsetParent !== null) {
      const offsetParentId = resolveNodeId?.(offsetParent);
      if (offsetParentId !== undefined) {
        layout.offsetParentId = offsetParentId;
      }
    }
  }

  if (element.tagName.toLowerCase() !== 'img') {
    return layout;
  }

  const image = element as HTMLImageElement;
  if (isNaturalDimension(image.naturalWidth)) {
    layout.naturalWidth = image.naturalWidth;
  }
  if (isNaturalDimension(image.naturalHeight)) {
    layout.naturalHeight = image.naturalHeight;
  }

  const objectFit = readObjectFit(element);
  if (objectFit !== undefined) {
    layout.objectFit = objectFit;
  }

  return layout;
}

function isNaturalDimension(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function readObjectFit(element: Element): ExtractionLayout['objectFit'] | undefined {
  try {
    const value = element.ownerDocument?.defaultView?.getComputedStyle(element).getPropertyValue('object-fit').trim();
    return value === 'fill' || value === 'contain' || value === 'cover' || value === 'none' || value === 'scale-down'
      ? value
      : undefined;
  } catch {
    return undefined;
  }
}

function finiteNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
