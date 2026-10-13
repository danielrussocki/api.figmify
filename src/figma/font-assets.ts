import type { FigmaFontAsset, FigmaNode } from '../contracts/figma/figma-document.js';

/**
 * Collects font families and weights used by visible TEXT nodes retained in the
 * Figma tree. A source URL is emitted only when a trusted, resolved mapping is
 * supplied by a caller that can determine it.
 */
export function collectUsedFontAssets(
  document: FigmaNode,
  fontSourceUrls: ReadonlyMap<string, string> = new Map(),
): FigmaFontAsset[] {
  const assetsByFamily = new Map<string, Set<number>>();

  const visit = (node: FigmaNode): void => {
    if (node.isVisible && node.type === 'TEXT' && node.styles !== undefined) {
      const { fontFamily, fontWeight } = node.styles;
      if (fontFamily.length > 0 && Number.isSafeInteger(fontWeight) && fontWeight > 0) {
        const weights = assetsByFamily.get(fontFamily) ?? new Set<number>();
        weights.add(fontWeight);
        assetsByFamily.set(fontFamily, weights);
      }
    }

    for (const child of node.children) {
      visit(child);
    }
  };

  visit(document);

  return [...assetsByFamily.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([family, weights]) => {
      const url = resolvedHttpUrl(fontSourceUrls.get(family));
      return {
        family,
        weights: [...weights].sort((left, right) => left - right),
        ...(url === undefined ? {} : { url }),
      };
    });
}

function resolvedHttpUrl(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}
