import { chromium, type Browser } from 'playwright';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';

import { PlaywrightExtractor } from '../../src/browser/playwright-extractor.js';
import type { ExtractionNode } from '../../src/contracts/extraction/extraction-document.js';
import type { FigmaNode } from '../../src/contracts/figma/figma-document.js';
import { transformExtractionDocument } from '../../src/figma/transformer.js';
import { startBrowserFixtureServer, type BrowserFixtureServer } from '../fixtures/browser/server.js';
import { validateFigmaDocumentV1 } from '../support/json-contract-validator.js';

let browser: Browser;
let fixtureServer: BrowserFixtureServer;

beforeAll(async () => {
  browser = await chromium.launch();
  fixtureServer = await startBrowserFixtureServer();
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await browser.close();
  await fixtureServer.close();
});

describe('Figma document browser integration', () => {
  test('creates the compact versioned document and omits hidden subtrees by default', async () => {
    const document = await extractAndTransform();

    expect(document).toMatchObject({
      schemaVersion: '1.0',
      source: {
        url: `${fixtureServer.url}/browser-fixtures.html`,
        viewport: { width: 1280, height: 720, deviceScaleFactor: 1 },
      },
      styles: { colors: expect.any(Array), typographies: expect.any(Array) },
      assets: expect.any(Array),
    });
    expect(findNodesByTag(document.document, 'p').filter((node) => !node.isVisible)).toHaveLength(0);
    expect(findNodeByCharacters(document.document, 'Visible fixture text')).toMatchObject({
      type: 'TEXT',
      characters: 'Visible fixture text',
      isVisible: true,
    });
    expectCompactNode(document.document, true);
  });

  test('retains hidden fixture nodes marked as not visible when requested', async () => {
    const document = await extractAndTransform(true);

    expect(findNodesByTag(document.document, 'p').filter((node) => !node.isVisible)).toHaveLength(3);
  });

  test('maps extracted layout, geometry, borders, and shadows to the extended Figma contract', async () => {
    const document = await extractAndTransform();

    expect(validateFigmaDocumentV1(document)).toEqual([]);
    const growingItem = findParentOfCharacters(document.document, 'Horizontal growing item');
    const horizontalFlex = growingItem === undefined ? undefined : findParentNode(document.document, growingItem);
    expect(horizontalFlex).toMatchObject({
      layoutMode: 'HORIZONTAL',
      itemSpacing: 12,
      gap: 12,
      padding: { top: 8, right: 16, bottom: 24, left: 32 },
      primaryAxisAlign: 'SPACE_BETWEEN',
      counterAxisAlign: 'CENTER',
    });
    expect(growingItem).toMatchObject({ layoutGrow: 1 });
    const columnFlowItem = findParentOfCharacters(document.document, 'Column-flow first item');
    const columnFlowGrid = columnFlowItem === undefined ? undefined : findParentNode(document.document, columnFlowItem);
    expect(columnFlowGrid).toMatchObject({
      layoutMode: 'VERTICAL', itemSpacing: 6, gap: 6,
    });

    const negativeMarginChild = findParentOfCharacters(document.document, 'Negative margin fixture');
    const geometryParent = negativeMarginChild === undefined ? undefined : findParentNode(document.document, negativeMarginChild);
    expect(negativeMarginChild?.relativeRect).toEqual({
      x: negativeMarginChild!.rect.x - geometryParent!.rect.x,
      y: negativeMarginChild!.rect.y - geometryParent!.rect.y,
      width: negativeMarginChild!.rect.width,
      height: negativeMarginChild!.rect.height,
      top: negativeMarginChild!.rect.y - geometryParent!.rect.y,
      left: negativeMarginChild!.rect.x - geometryParent!.rect.x,
    });
    expect(findParentOfCharacters(document.document, 'Sticky fixture')).toMatchObject({ position: 'sticky' });

    expect(findParentOfCharacters(document.document, 'Uniform border fixture')).toMatchObject({
      strokes: [{ type: 'SOLID', weight: 3, color: { r: 0.078, g: 0.157, b: 0.235, a: 1 } }],
      strokeWeight: 3,
    });
    expect(findParentOfCharacters(document.document, 'Per-side border fixture')).toMatchObject({
      strokes: [
        { side: 'TOP', weight: 1 }, { side: 'RIGHT', weight: 2 },
        { side: 'BOTTOM', weight: 3 }, { side: 'LEFT', weight: 4 },
      ],
      strokeWeights: { top: 1, right: 2, bottom: 3, left: 4 },
    });
    expect(findParentOfCharacters(document.document, 'Multiple shadow fixture')).toMatchObject({
      effects: [
        { type: 'DROP_SHADOW', offset: { x: 2, y: 4 }, radius: 6, spread: 1 },
        { type: 'INNER_SHADOW', offset: { x: -1, y: -2 }, radius: 3, spread: 0 },
      ],
    });
  });

  test('preserves transparent fills and resolved img and background sources as IMAGE paints', async () => {
    shortenPostLoadWait();
    const extractor = new PlaywrightExtractor(browser, 'development');
    const extraction = await extractor.extract({
      url: `${fixtureServer.url}/browser-fixtures.html`,
      viewport: { width: 1280, height: 720, deviceScaleFactor: 1 },
    });
    const source = `${fixtureServer.url}/resources/fixture-image.svg`;
    const transparent = requireExtractionNode(extraction.document, 'no-perceptible-background');
    const image = requireExtractionNode(extraction.document, 'resolvable-img-image');
    const background = requireExtractionNode(extraction.document, 'resolvable-background-image');

    expect(transparent.styles['background-color'])
      .toMatch(/transparent|rgba\(0, 0, 0, 0\)/u);
    expect(image.resources)
      .toContainEqual({ kind: 'image', url: source });
    expect(background.styles)
      .toMatchObject({ 'background-image': `url("${source}")`, 'background-size': 'cover' });

    const document = transformExtractionDocument(extraction);

    expect(findNodeById(document.document, transparent.id)).toMatchObject({
      fills: [],
    });
    expect(findNodeById(document.document, image.id)).toMatchObject({
      type: 'IMAGE',
      fills: [{ type: 'IMAGE', src: source, scaleMode: 'FILL' }],
    });
    expect(findNodeById(document.document, background.id)).toMatchObject({
      type: 'IMAGE',
      fills: [{ type: 'IMAGE', src: source, scaleMode: 'FILL' }],
    });
  });
});

async function extractAndTransform(includeHidden = false) {
  shortenPostLoadWait();
  const extractor = new PlaywrightExtractor(browser, 'development');
  const extraction = await extractor.extract({
    url: `${fixtureServer.url}/browser-fixtures.html`,
    viewport: { width: 1280, height: 720, deviceScaleFactor: 1 },
  });

  return transformExtractionDocument(extraction, { includeHidden });
}

function shortenPostLoadWait(): void {
  const newContext = browser.newContext.bind(browser);
  vi.spyOn(browser, 'newContext').mockImplementation(async (...arguments_) => {
    const context = await newContext(...arguments_);
    context.on('page', (page) => {
      vi.spyOn(page, 'waitForTimeout').mockResolvedValue(undefined);
    });
    return context;
  });
}

function findNodeByCharacters(node: FigmaNode, characters: string): FigmaNode | undefined {
  if (node.characters === characters) return node;

  for (const child of node.children) {
    const match = findNodeByCharacters(child, characters);
    if (match !== undefined) return match;
  }

  return undefined;
}

function findNodeById(node: FigmaNode, id: string): FigmaNode | undefined {
  if (node.id === id) return node;

  for (const child of node.children) {
    const match = findNodeById(child, id);
    if (match !== undefined) return match;
  }

  return undefined;
}

function findExtractionNodeById(node: ExtractionNode, id: string): ExtractionNode | undefined {
  if (node.attributes.id === id) return node;

  for (const child of [...node.children, ...(node.shadowChildren ?? [])]) {
    const match = findExtractionNodeById(child, id);
    if (match !== undefined) return match;
  }

  return undefined;
}

function requireExtractionNode(node: ExtractionNode, id: string): ExtractionNode {
  const match = findExtractionNodeById(node, id);
  if (match === undefined) throw new Error(`Missing extraction fixture node: ${id}`);
  return match;
}

function findParentOfCharacters(node: FigmaNode, characters: string): FigmaNode | undefined {
  if (node.children.some((child) => child.characters === characters)) return node;

  for (const child of node.children) {
    const match = findParentOfCharacters(child, characters);
    if (match !== undefined) return match;
  }

  return undefined;
}

function findParentNode(node: FigmaNode, target: FigmaNode): FigmaNode | undefined {
  if (node.children.includes(target)) return node;

  for (const child of node.children) {
    const match = findParentNode(child, target);
    if (match !== undefined) return match;
  }

  return undefined;
}

function findNodesByTag(node: FigmaNode, tag: string): FigmaNode[] {
  return [node, ...node.children.flatMap((child) => findNodesByTag(child, tag))]
    .filter((candidate) => candidate.tag === tag);
}

function expectCompactNode(node: FigmaNode, isRoot: boolean): void {
  expect(node).toEqual(expect.objectContaining({
    id: expect.any(String),
    tag: expect.any(String),
    type: expect.stringMatching(/^(FRAME|TEXT|IMAGE)$/),
    isVisible: expect.any(Boolean),
    rect: {
      x: expect.any(Number), y: expect.any(Number), width: expect.any(Number),
      height: expect.any(Number), top: expect.any(Number), left: expect.any(Number),
    },
    children: expect.any(Array),
  }));
  expect(node).not.toHaveProperty('sourceId');
  expect(node).not.toHaveProperty('name');
  expect(node.relativeRect === undefined).toBe(isRoot);

  for (const child of node.children) expectCompactNode(child, false);
}
