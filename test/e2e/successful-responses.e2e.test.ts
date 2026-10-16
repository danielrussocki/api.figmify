import Fastify, { type FastifyInstance } from 'fastify';
import { chromium, type Browser } from 'playwright';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';

import { CreateFigmaDocumentUseCase } from '../../src/application/create-figma-document/create-figma-document.js';
import { ExtractDocumentUseCase } from '../../src/application/extract-document/extract-document.js';
import { PlaywrightExtractor } from '../../src/browser/playwright-extractor.js';
import type { ExtractionDocument } from '../../src/contracts/extraction/extraction-document.js';
import type { FigmaDocument } from '../../src/contracts/figma/figma-document.js';
import { registerApplicationErrorHandler } from '../../src/http/error-handler/application-error-handler.js';
import { registerExtractRoute } from '../../src/http/routes/extract-route.js';
import { registerFigmaRoute } from '../../src/http/routes/figma-route.js';
import { startBrowserFixtureServer, type BrowserFixtureServer } from '../fixtures/browser/server.js';
import { validateFigmaDocumentV1 } from '../support/json-contract-validator.js';

let application: FastifyInstance;
let applicationUrl: string;
let browser: Browser;
let fixtureServer: BrowserFixtureServer;

beforeAll(async () => {
  browser = await chromium.launch();
  fixtureServer = await startBrowserFixtureServer();
  shortenPostLoadWait(browser);

  const extractor = new PlaywrightExtractor(browser, 'development');
  const extractDocument = new ExtractDocumentUseCase(extractor, 'development');
  const createFigmaDocument = new CreateFigmaDocumentUseCase(extractor);

  application = Fastify();
  registerApplicationErrorHandler(application);
  registerExtractRoute(application, extractDocument);
  registerFigmaRoute(application, createFigmaDocument);
  applicationUrl = await application.listen({ host: '127.0.0.1', port: 0 });
});

afterAll(async () => {
  await application.close();
  await fixtureServer.close();
  await browser.close();
  vi.restoreAllMocks();
});

describe('successful HTTP responses', () => {
  test('GET /v1/extract returns an ExtractionDocument v1 with the default viewport', async () => {
    const document = await requestJson<ExtractionDocument>('/v1/extract');

    expect(document).toMatchObject({
      schemaVersion: '1.0',
      source: {
        url: `${fixtureServer.url}/browser-fixtures.html`,
        viewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
        environment: {
          locale: 'en-US',
          timezone: 'UTC',
          colorScheme: 'light',
          reducedMotion: 'no-preference',
        },
      },
      document: { id: expect.any(String), tagName: 'html' },
    });
  });

  test('GET /v1/extract returns an ExtractionDocument v1 with the configured viewport', async () => {
    const document = await requestJson<ExtractionDocument>('/v1/extract', {
      width: '1280',
      height: '720',
      deviceScaleFactor: '2',
    });

    expect(document).toMatchObject({
      schemaVersion: '1.0',
      source: {
        viewport: { width: 1280, height: 720, deviceScaleFactor: 2 },
      },
      document: { id: expect.any(String), tagName: 'html' },
    });
  });

  test('GET /v1/figma returns a FigmaDocument v1.1 with the default viewport', async () => {
    const document = await requestJson<FigmaDocument>('/v1/figma');

    expect(document).toMatchObject({
      schemaVersion: '1.1',
      source: {
        url: `${fixtureServer.url}/browser-fixtures.html`,
        viewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
      },
      styles: { colors: expect.any(Array), typographies: expect.any(Array) },
      document: {
        id: expect.any(String),
        tag: 'html',
        type: expect.stringMatching(/^(FRAME|TEXT|IMAGE)$/),
        rect: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
        isVisible: expect.any(Boolean),
      },
    });
    expect(findNodesByTag(document.document, 'p').filter((node) => !node.isVisible)).toHaveLength(0);
  });

  test('GET /v1/figma retains hidden nodes when includeHidden is true', async () => {
    const document = await requestJson<FigmaDocument>('/v1/figma', { includeHidden: 'true' });

    expect(findNodesByTag(document.document, 'p').filter((node) => !node.isVisible)).toHaveLength(3);
  });

  test('GET /v1/figma returns the v1.1 CSS background FRAME with ordered fills and children', async () => {
    const document = await requestJson<FigmaDocument>('/v1/figma');
    const source = `${fixtureServer.url}/resources/fixture-image.svg`;
    const firstChild = findParentOfCharacters(document.document, 'CSS background first child');
    const frame = firstChild === undefined ? undefined : findParentNode(document.document, firstChild);

    expect(document.schemaVersion).toBe('1.1');
    expect(frame).toMatchObject({
      tag: 'div',
      type: 'FRAME',
      layoutMode: 'HORIZONTAL',
      fills: [
        { type: 'IMAGE', src: source, scaleMode: 'TILE' },
        { type: 'SOLID', color: { r: 0.118, g: 0.235, b: 0.353, a: 1 } },
      ],
      children: [
        { tag: 'div' },
        { tag: 'div' },
      ],
    });
    expect(frame).not.toHaveProperty('image');
  });

  test('GET /v1/figma emits direct and styled text leaves in DOM order without duplication', async () => {
    const document = await requestJson<FigmaDocument>('/v1/figma');
    const textNodes = flattenNodes(document.document).filter((node) => node.type === 'TEXT');
    const mixedCharacters = textNodes
      .filter((node) => ['Hello ', 'world', ' again'].includes(node.characters ?? ''))
      .map((node) => node.characters);

    expect(mixedCharacters).toEqual(['Hello ', 'world', ' again']);
    expect(textNodes.filter((node) => node.characters === 'Hello world again')).toHaveLength(0);
  });

  test('GET /v1/figma returns CSS background paints, complete inline SVG, and used font assets', async () => {
    const document = await requestJson<FigmaDocument>('/v1/figma');

    expect(flattenNodes(document.document).find((node) => node.tag === 'div'
      && node.type === 'FRAME'
      && node.fills?.some((fill) => fill.type === 'IMAGE'
        && fill.src === `${fixtureServer.url}/resources/fixture-image.svg`))).toMatchObject({
      type: 'FRAME',
      fills: expect.arrayContaining([
        { type: 'IMAGE', src: `${fixtureServer.url}/resources/fixture-image.svg`, scaleMode: 'TILE' },
      ]),
    });
    expect(flattenNodes(document.document).find((node) => node.tag === 'svg' && node.svg?.includes('<circle'))).toMatchObject({
      type: 'FRAME',
      svg: expect.stringContaining('<circle cx="24" cy="24" r="16" fill="rgb(20, 80, 160)"></circle>'),
    });
    expect(document.assets).toContainEqual({
      family: 'Fixture Sans',
      weights: [700],
      url: `${fixtureServer.url}/resources/fixture-font.woff2`,
    });
  });

  test('GET /v1/figma returns empty transparent fills and IMAGE paints for resolved images', async () => {
    const document = await requestJson<FigmaDocument>('/v1/figma');
    const source = `${fixtureServer.url}/resources/fixture-image.svg`;
    const transparentNode = findParentOfCharacters(document.document, 'No perceptible background fixture');
    const imageNodes = flattenNodes(document.document)
      .filter((node) => node.type === 'IMAGE' && node.image?.src === source);
    const backgroundNodes = flattenNodes(document.document)
      .filter((node) => node.type === 'FRAME'
        && node.fills?.some((fill) => fill.type === 'IMAGE' && fill.src === source));

    expect(validateFigmaDocumentV1(document)).toEqual([]);
    expect(transparentNode?.fills).toEqual([]);
    expect(imageNodes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        image: expect.objectContaining({ naturalWidth: expect.any(Number) }),
        fills: [{ type: 'IMAGE', src: source, scaleMode: 'FILL' }],
      }),
    ]));
    expect(imageNodes.flatMap((node) => node.fills ?? [])).toEqual(
      imageNodes.map(() => ({ type: 'IMAGE', src: source, scaleMode: 'FILL' })),
    );
    expect(backgroundNodes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        fills: expect.arrayContaining([{ type: 'IMAGE', src: source, scaleMode: 'TILE' }]),
      }),
    ]));
  });

  test('GET /v1/figma applies includeHidden to the hidden text subtree', async () => {
    const withoutHidden = await requestJson<FigmaDocument>('/v1/figma');
    const withHidden = await requestJson<FigmaDocument>('/v1/figma', { includeHidden: 'true' });

    expect(findNodesByTag(withoutHidden.document, 'section')).toHaveLength(0);
    expect(findNodesByTag(withHidden.document, 'section')).toMatchObject([{
      isVisible: false,
      children: [{ tag: 'span', isVisible: false }],
    }]);
  });

  test('GET /v1/extract preserves textual fractional opacity for visible fixture nodes', async () => {
    const document = await requestJson<ExtractionDocument>('/v1/extract');
    const element = findExtractionNodeById(document.document, 'fractional-opacity-element');
    const directText = findExtractionNodeById(document.document, 'fractional-opacity-direct-text');

    expect(element?.styles.opacity).toBe('0.8');
    expect(directText?.directTextRuns).toEqual([
      expect.objectContaining({
        characters: 'Visible direct text with fractional opacity',
        styles: expect.objectContaining({ opacity: '0.5' }),
      }),
    ]);
  });

  test('GET /v1/figma maps fractional opacity to visible numeric node opacity', async () => {
    const document = await requestJson<FigmaDocument>('/v1/figma');
    const element = findParentOfCharacters(document.document, 'Visible element with fractional opacity');
    const directText = findNodeByCharacters(document.document, 'Visible direct text with fractional opacity');

    expect(element).toMatchObject({ opacity: 0.8, isVisible: true });
    expect(directText).toMatchObject({ opacity: 0.5, isVisible: true });
  });

  test('GET /v1/figma returns a FigmaDocument v1.1 with the configured viewport', async () => {
    const document = await requestJson<FigmaDocument>('/v1/figma', {
      width: '1440',
      height: '900',
      deviceScaleFactor: '3',
    });

    expect(document).toMatchObject({
      schemaVersion: '1.1',
      source: {
        viewport: { width: 1440, height: 900, deviceScaleFactor: 3 },
      },
      styles: { colors: expect.any(Array), typographies: expect.any(Array) },
      document: {
        id: expect.any(String),
        tag: 'html',
        type: expect.stringMatching(/^(FRAME|TEXT|IMAGE)$/),
        rect: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
        isVisible: expect.any(Boolean),
      },
    });
  });

  test('GET /v1/figma returns the extended layout and paint contract for browser fixtures', async () => {
    const document = await requestJson<FigmaDocument>('/v1/figma');

    expect(validateFigmaDocumentV1(document)).toEqual([]);
    const growingItem = findParentOfCharacters(document.document, 'Vertical growing item');
    const verticalFlex = growingItem === undefined ? undefined : findParentNode(document.document, growingItem);
    expect(verticalFlex).toMatchObject({
      layoutMode: 'VERTICAL', itemSpacing: 10, gap: 10,
      padding: { top: 4, right: 12, bottom: 20, left: 28 },
      primaryAxisAlign: 'MAX', counterAxisAlign: 'MIN',
    });
    expect(findParentOfCharacters(document.document, 'Per-side border fixture')).toMatchObject({
      strokes: expect.arrayContaining([
        expect.objectContaining({ side: 'TOP', weight: 1 }),
        expect.objectContaining({ side: 'LEFT', weight: 4 }),
      ]),
      strokeWeights: { top: 1, right: 2, bottom: 3, left: 4 },
    });
    expect(findParentOfCharacters(document.document, 'Multiple shadow fixture')?.effects).toEqual([
      expect.objectContaining({ type: 'DROP_SHADOW', offset: { x: 2, y: 4 }, radius: 6, spread: 1 }),
      expect.objectContaining({ type: 'INNER_SHADOW', offset: { x: -1, y: -2 }, radius: 3, spread: 0 }),
    ]);
  });
});

async function requestJson<T>(
  path: string,
  viewport: Record<string, string> = {},
): Promise<T> {
  const query = new URLSearchParams({
    url: `${fixtureServer.url}/browser-fixtures.html`,
    ...viewport,
  });
  const response = await fetch(`${applicationUrl}${path}?${query}`);

  expect(response.status).toBe(200);
  return response.json() as Promise<T>;
}

function shortenPostLoadWait(browserInstance: Browser): void {
  const newContext = browserInstance.newContext.bind(browserInstance);
  vi.spyOn(browserInstance, 'newContext').mockImplementation(async (...arguments_) => {
    const context = await newContext(...arguments_);
    context.on('page', (page) => {
      vi.spyOn(page, 'waitForTimeout').mockResolvedValue(undefined);
    });
    return context;
  });
}

function findNodeByCharacters(
  node: FigmaDocument['document'],
  characters: string,
): FigmaDocument['document'] | undefined {
  if (node.characters === characters) return node;

  for (const child of node.children) {
    const match = findNodeByCharacters(child, characters);
    if (match !== undefined) return match;
  }

  return undefined;
}

function findExtractionNodeById(
  node: ExtractionDocument['document'],
  id: string,
): ExtractionDocument['document'] | undefined {
  if (node.attributes.id === id) return node;

  for (const child of node.children) {
    const match = findExtractionNodeById(child, id);
    if (match !== undefined) return match;
  }

  return undefined;
}

function findParentOfCharacters(
  node: FigmaDocument['document'],
  characters: string,
): FigmaDocument['document'] | undefined {
  if (node.children.some((child) => child.characters === characters)) return node;

  for (const child of node.children) {
    const match = findParentOfCharacters(child, characters);
    if (match !== undefined) return match;
  }

  return undefined;
}

function findParentNode(
  node: FigmaDocument['document'],
  target: FigmaDocument['document'],
): FigmaDocument['document'] | undefined {
  if (node.children.includes(target)) return node;

  for (const child of node.children) {
    const match = findParentNode(child, target);
    if (match !== undefined) return match;
  }

  return undefined;
}

function findNodesByTag(
  node: FigmaDocument['document'],
  tag: string,
): FigmaDocument['document'][] {
  return [node, ...node.children.flatMap((child) => findNodesByTag(child, tag))]
    .filter((candidate) => candidate.tag === tag);
}

function flattenNodes(node: FigmaDocument['document']): FigmaDocument['document'][] {
  return [node, ...node.children.flatMap(flattenNodes)];
}
