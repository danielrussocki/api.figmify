import type { FontFaceSource } from '../contracts/extraction/extraction-document.js';
import type { FigmaFontAsset, FigmaNode } from '../contracts/figma/figma-document.js';

type FontSourceUrls = ReadonlyMap<string, string> | readonly FontFaceSource[];

/**
 * Collects font families and weights used by visible TEXT nodes retained in the
 * Figma tree. A source URL is emitted only when a detected @font-face source
 * matches one of the family's used weights.
 */
export function collectUsedFontAssets(
  document: FigmaNode,
  fontSourceUrls: FontSourceUrls = new Map(),
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
      const url = sourceUrlForFamily(fontSourceUrls, family, weights);
      return {
        family,
        weights: [...weights].sort((left, right) => left - right),
        ...(url === undefined ? {} : { url }),
      };
    });
}

function sourceUrlForFamily(
  sources: FontSourceUrls,
  family: string,
  weights: ReadonlySet<number>,
): string | undefined {
  if (isFontFaceSourceList(sources)) {
    const matchingSource = sources
      .filter((source) => source.family === family && weights.has(source.weight))
      .map((source) => ({ ...source, url: resolvedHttpUrl(source.url) }))
      .filter((source): source is FontFaceSource & { url: string } => source.url !== undefined)
      .sort((left, right) => left.weight - right.weight || left.url.localeCompare(right.url))[0];

    return matchingSource?.url;
  }

  return resolvedHttpUrl(sources.get(family));
}

function isFontFaceSourceList(sources: FontSourceUrls): sources is readonly FontFaceSource[] {
  return Array.isArray(sources);
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
