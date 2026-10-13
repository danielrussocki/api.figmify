import type { Browser, BrowserContext, Frame, Page, Route, Response } from 'playwright';

import {
  MainDocumentRedirectError,
  UpstreamFailureException,
} from '../contracts/errors/application-error.js';
import type { ExtractionDocument, ExtractionNode, FontFaceSource } from '../contracts/extraction/extraction-document.js';
import type { ExtractionPort, ExtractionRequest } from '../contracts/extraction/extraction-port.js';
import { FIXED_RENDERING_ENVIRONMENT } from '../contracts/extraction/defaults.js';
import {
  PublicUrlPolicy,
  PublicUrlPolicyError,
  type RuntimeEnvironment,
} from '../security/url-policy/public-url-policy.js';
import { VISUAL_PROPERTIES } from './visual-properties.js';

const POST_LOAD_SERIALIZATION_DELAY_MS = 30_000;

/**
 * Creates isolated Playwright contexts configured for reproducible extraction.
 */
export class PlaywrightExtractor implements ExtractionPort {
  constructor(
    private readonly browser: Browser,
    private readonly environment: RuntimeEnvironment = 'production',
    private readonly publicUrlPolicy = new PublicUrlPolicy(),
  ) {}

  createContext(request: ExtractionRequest): Promise<BrowserContext> {
    return this.browser.newContext({
      viewport: {
        width: request.viewport.width,
        height: request.viewport.height,
      },
      deviceScaleFactor: request.viewport.deviceScaleFactor,
      locale: FIXED_RENDERING_ENVIRONMENT.locale,
      timezoneId: FIXED_RENDERING_ENVIRONMENT.timezone,
      colorScheme: FIXED_RENDERING_ENVIRONMENT.colorScheme,
      reducedMotion: FIXED_RENDERING_ENVIRONMENT.reducedMotion,
      contrast: FIXED_RENDERING_ENVIRONMENT.contrast,
      userAgent: FIXED_RENDERING_ENVIRONMENT.userAgent,
    });
  }

  async extract(request: ExtractionRequest): Promise<ExtractionDocument> {
    const context = await this.createContext(request);
    let page: Page | undefined;

    try {
      page = await context.newPage();
      await this.navigateMainDocument(page, request.url);
      const serialized = await page.evaluate(serializeDocumentElement, [...VISUAL_PROPERTIES]);

      return {
        schemaVersion: '1.0',
        source: {
          url: request.url,
          viewport: request.viewport,
          environment: {
            locale: FIXED_RENDERING_ENVIRONMENT.locale,
            timezone: FIXED_RENDERING_ENVIRONMENT.timezone,
            colorScheme: FIXED_RENDERING_ENVIRONMENT.colorScheme,
            reducedMotion: FIXED_RENDERING_ENVIRONMENT.reducedMotion,
          },
        },
        ...(serialized.fontFaceSources.length === 0 ? {} : { fontFaceSources: serialized.fontFaceSources }),
        document: serialized.document,
      };
    } catch (error) {
      if (
        error instanceof PublicUrlPolicyError ||
        error instanceof MainDocumentRedirectError ||
        error instanceof UpstreamFailureException
      ) {
        throw error;
      }

      throw new UpstreamFailureException();
    } finally {
      await page?.close().catch(() => undefined);
      await context.close().catch(() => undefined);
    }
  }

  async navigateMainDocument(page: Page, url: string): Promise<void> {
    let redirected = false;
    let initialMainDocumentNavigationCommitted = false;
    let nonPublicDestinationError: PublicUrlPolicyError | undefined;
    const detectMainDocumentRedirect = (response: Response): void => {
      const navigationRequest = response.request();
      const isMainDocumentNavigation =
        navigationRequest.isNavigationRequest() && navigationRequest.frame() === page.mainFrame();

      if (isMainDocumentNavigation && response.status() >= 300 && response.status() < 400) {
        redirected = true;
      }
    };
    const detectSubsequentMainDocumentNavigation = (frame: Frame): void => {
      if (frame !== page.mainFrame()) {
        return;
      }

      if (initialMainDocumentNavigationCommitted) {
        redirected = true;
        return;
      }

      initialMainDocumentNavigationCommitted = true;
    };
    const enforceMainDocumentDestinationPolicy = async (route: Route): Promise<void> => {
      const navigationRequest = route.request();
      const isMainDocumentNavigation =
        navigationRequest.isNavigationRequest() && navigationRequest.frame() === page.mainFrame();

      if (!isMainDocumentNavigation) {
        await route.continue();
        return;
      }

      try {
        await this.publicUrlPolicy.enforceResolved(
          new URL(navigationRequest.url()),
          this.environment,
        );
      } catch (error) {
        if (error instanceof PublicUrlPolicyError) {
          nonPublicDestinationError = error;
          await route.abort();
          return;
        }

        throw error;
      }

      await route.continue();
    };

    page.on('response', detectMainDocumentRedirect);
    page.on('framenavigated', detectSubsequentMainDocumentNavigation);
    await page.route('**/*', enforceMainDocumentDestinationPolicy);
    try {
      const response = await page.goto(url);
      if (nonPublicDestinationError !== undefined) {
        throw nonPublicDestinationError;
      }

      if (redirected) {
        throw new MainDocumentRedirectError();
      }

      if (response !== null && response.status() >= 300 && response.status() < 400) {
        throw new MainDocumentRedirectError();
      }

      if (response === null || response.status() < 200 || response.status() >= 300) {
        throw new UpstreamFailureException();
      }

      await page.waitForLoadState('load');
      await page.waitForTimeout(POST_LOAD_SERIALIZATION_DELAY_MS);

      if (redirected) {
        throw new MainDocumentRedirectError();
      }
    } catch (error) {
      if (nonPublicDestinationError !== undefined) {
        throw nonPublicDestinationError;
      }

      if (error instanceof PublicUrlPolicyError) {
        throw error;
      }

      if (error instanceof MainDocumentRedirectError) {
        throw error;
      }

      throw new UpstreamFailureException();
    } finally {
      page.off('response', detectMainDocumentRedirect);
      page.off('framenavigated', detectSubsequentMainDocumentNavigation);
      await page.unroute('**/*', enforceMainDocumentDestinationPolicy);
    }
  }
}

function serializeDocumentElement(visualProperties: string[]): {
  document: ExtractionNode;
  fontFaceSources: FontFaceSource[];
} {
  const allowedAttributes = new Map([
    'id', 'class', 'role', 'title', 'lang', 'dir', 'hidden', 'tabindex', 'alt', 'aria-label',
    'aria-labelledby', 'aria-describedby', 'aria-hidden', 'href', 'target', 'src', 'srcset',
    'poster', 'width', 'height', 'type', 'value', 'placeholder', 'checked', 'selected',
    'disabled', 'name', 'viewBox',
  ].map((name) => [name.toLowerCase(), name]));
  let nextId = 1;
  const nodeIds = new Map<Element, string>();
  const isPositiveFractionalOpacity = (value: unknown): value is string => {
    if (typeof value !== 'string') return false;

    const opacity = Number(value.trim());
    return Number.isFinite(opacity) && opacity > 0 && opacity < 1;
  };

  const readStyles = (element: Element, pseudoElement?: '::before' | '::after'): Record<string, string> => {
    const styles: Record<string, string> = {};
    let computed: CSSStyleDeclaration;
    try {
      computed = window.getComputedStyle(element, pseudoElement);
    } catch {
      return styles;
    }
    for (const property of visualProperties) {
      try {
        const value = computed.getPropertyValue(property);
        if (property === 'opacity' && isPositiveFractionalOpacity(value)) {
          styles[property] = value;
          continue;
        }
        if (typeof value === 'string' && value.trim().length > 0) {
          styles[property] = value;
        }
      } catch {
        // Omit values that cannot be determined or serialized.
      }
    }
    return styles;
  };

  const isRendered = (element: Element): boolean => {
    let current: Element | null = element;
    while (current !== null) {
      if (current.hasAttribute('hidden')) return false;
      const styles = window.getComputedStyle(current);
      if (styles.display === 'none') return false;
      if (current === element && (styles.visibility === 'hidden' || styles.visibility === 'collapse')) return false;
      current = current.parentElement;
    }
    return true;
  };

  const pseudoElement = (element: Element, selector: '::before' | '::after') => {
    let content: string;
    try {
      content = window.getComputedStyle(element, selector).getPropertyValue('content').trim();
    } catch {
      return null;
    }
    if (content.length === 0 || content === 'none' || content === 'normal') return null;
    if ((content.startsWith('"') && content.endsWith('"')) || (content.startsWith("'") && content.endsWith("'"))) {
      content = content.slice(1, -1).replace(/\\([\\"'])/g, '$1');
    }
    return { content, styles: readStyles(element, selector) };
  };

  const resources = (element: Element): ExtractionNode['resources'] => {
    const result: ExtractionNode['resources'] = [];
    const attribute = (name: string) => element.getAttribute(name);
    const add = (kind: ExtractionNode['resources'][number]['kind'], reference: string | null) => {
      if (reference === null || reference.trim().length === 0) return;
      try { result.push({ kind, url: new URL(reference, element.baseURI).href }); } catch { /* Ignore invalid URLs. */ }
    };
    const tagName = element.tagName.toLowerCase();
    if (tagName === 'img' || (tagName === 'input' && attribute('type')?.toLowerCase() === 'image')) add('image', attribute('src'));
    if (tagName === 'img' || tagName === 'source') {
      for (const candidate of attribute('srcset')?.split(',') ?? []) add('image', candidate.trim().split(/\s+/, 1)[0] ?? null);
    }
    if (tagName === 'video') { add('media', attribute('poster')); add('media', attribute('src')); }
    if (tagName === 'audio' || tagName === 'source') add('media', attribute('src'));
    if (tagName === 'link' && attribute('rel')?.split(/\s+/).some((value) => value.toLowerCase() === 'stylesheet')) add('stylesheet', attribute('href'));
    return result;
  };

  const layout = (element: Element): ExtractionNode['layout'] => {
    const zeroRect = { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0 };
    const metadata: Omit<NonNullable<ExtractionNode['layout']>, 'rect'> = {};
    if ('offsetParent' in element) {
      const offsetParent = (element as HTMLElement).offsetParent;
      metadata.hasOffsetParent = offsetParent !== null;
      if (offsetParent !== null) {
        const offsetParentId = nodeIds.get(offsetParent);
        if (offsetParentId !== undefined) metadata.offsetParentId = offsetParentId;
      }
    }
    if (element.tagName.toLowerCase() === 'img') {
      const image = element as HTMLImageElement;
      if (Number.isFinite(image.naturalWidth) && image.naturalWidth >= 0) metadata.naturalWidth = image.naturalWidth;
      if (Number.isFinite(image.naturalHeight) && image.naturalHeight >= 0) metadata.naturalHeight = image.naturalHeight;
      try {
        const objectFit = window.getComputedStyle(element).getPropertyValue('object-fit').trim();
        if (objectFit === 'fill' || objectFit === 'contain' || objectFit === 'cover' || objectFit === 'none' || objectFit === 'scale-down') {
          metadata.objectFit = objectFit;
        }
      } catch {
        // Omit an indeterminable computed object-fit value.
      }
    }
    try {
      const box = element.getBoundingClientRect();
      if (box.width === 0 && box.height === 0) return { rect: zeroRect, ...metadata };

      const rect = {
        x: box.x + window.scrollX,
        y: box.y + window.scrollY,
        width: box.width,
        height: box.height,
        top: box.top + window.scrollY,
        left: box.left + window.scrollX,
      };
      return Object.values(rect).every(Number.isFinite) ? { rect, ...metadata } : { rect: zeroRect, ...metadata };
    } catch {
      return { rect: zeroRect, ...metadata };
    }
  };

  const directTextRuns = (element: Element): NonNullable<ExtractionNode['directTextRuns']> => {
    if (!isRendered(element)) return [];

    const styles = readStyles(element);
    const runs: NonNullable<ExtractionNode['directTextRuns']> = [];
    for (const [childNodeIndex, childNode] of Array.from(element.childNodes).entries()) {
      if (childNode.nodeType !== Node.TEXT_NODE
        || typeof childNode.textContent !== 'string'
        || childNode.textContent.trim().length === 0) {
        continue;
      }

      runs.push({ characters: childNode.textContent, childNodeIndex, styles });
    }

    return runs;
  };

  const serialize = (element: Element): ExtractionNode => {
    const id = `node-${nextId++}`;
    nodeIds.set(element, id);
    const attributes: Record<string, string> = {};
    for (const name of element.getAttributeNames()) {
      const outputName = allowedAttributes.get(name.toLowerCase());
      const value = element.getAttribute(name);
      if (outputName !== undefined && value !== null) attributes[outputName] = value;
    }
    const textRuns = directTextRuns(element);
    const text = textRuns.length === 0 && isRendered(element) && typeof (element as HTMLElement).innerText === 'string'
      ? (element as HTMLElement).innerText.trim() || null
      : null;
    const svg = element.tagName.toLowerCase() === 'svg' && typeof element.outerHTML === 'string' && element.outerHTML.length > 0
      ? element.outerHTML
      : undefined;
    const node: ExtractionNode = {
      id,
      tagName: element.tagName.toLowerCase(),
      attributes,
      resources: resources(element),
      text,
      layout: layout(element),
      styles: readStyles(element),
      pseudoElements: { before: pseudoElement(element, '::before'), after: pseudoElement(element, '::after') },
      ...(svg === undefined ? {} : { svg }),
      children: Array.from(element.children, serialize),
    };
    if (textRuns.length > 0) node.directTextRuns = textRuns;
    if (element.shadowRoot !== null) node.shadowChildren = Array.from(element.shadowRoot.children, serialize);
    return node;
  };

  return {
    document: serialize(document.documentElement),
    fontFaceSources: readFontFaceSources(),
  };

  function readFontFaceSources(): FontFaceSource[] {
    const sources: FontFaceSource[] = [];

    for (const stylesheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList;
      try {
        rules = stylesheet.cssRules;
      } catch {
        // Cross-origin stylesheets and inaccessible rules are intentionally ignored.
        continue;
      }

      for (const rule of Array.from(rules)) {
        if (rule.type !== CSSRule.FONT_FACE_RULE) {
          continue;
        }

        const style = (rule as CSSFontFaceRule).style;
        const family = readFontFamily(style.getPropertyValue('font-family'));
        const weight = readFontWeight(style.getPropertyValue('font-weight'));

        if (family === undefined || weight === undefined) {
          continue;
        }

        for (const reference of readFontUrls(style.getPropertyValue('src'))) {
          try {
            const url = new URL(reference, stylesheet.href ?? document.baseURI);
            if (url.protocol === 'http:' || url.protocol === 'https:') {
              sources.push({ family, weight, url: url.href });
            }
          } catch {
            // Ignore font source URLs that cannot be resolved safely.
          }
        }
      }
    }

    return sources;
  }

  function readFontFamily(value: string): string | undefined {
    const family = value.trim();
    if (family.length === 0) return undefined;
    if ((family.startsWith('"') && family.endsWith('"')) || (family.startsWith("'") && family.endsWith("'"))) {
      const unquoted = family.slice(1, -1).trim();
      return unquoted.length > 0 ? unquoted : undefined;
    }
    return family;
  }

  function readFontWeight(value: string): number | undefined {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'normal') return 400;
    if (normalized === 'bold') return 700;
    if (!/^\d{1,4}$/.test(normalized)) return undefined;

    const weight = Number(normalized);
    return weight >= 1 && weight <= 1000 ? weight : undefined;
  }

  function readFontUrls(value: string): string[] {
    const urls: string[] = [];
    const matcher = /url\(\s*(['"]?)(.*?)\1\s*\)/gi;
    let match: RegExpExecArray | null;

    while ((match = matcher.exec(value)) !== null) {
      const reference = match[2]?.trim();
      if (reference !== undefined && reference.length > 0) {
        urls.push(reference);
      }
    }

    return urls;
  }
}
