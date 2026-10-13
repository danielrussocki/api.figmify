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
export function inspectLayout(element: Element): ExtractionLayout {
  try {
    const box = element.getBoundingClientRect();
    const view = element.ownerDocument?.defaultView;
    const scrollX = finiteNumber(view?.scrollX);
    const scrollY = finiteNumber(view?.scrollY);

    if (box.width === 0 && box.height === 0) {
      return { rect: { ...ZERO_RECT } };
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
      ? { rect }
      : { rect: { ...ZERO_RECT } };
  } catch {
    return { rect: { ...ZERO_RECT } };
  }
}

function finiteNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
