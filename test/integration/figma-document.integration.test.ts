import { chromium, type Browser } from 'playwright';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';

import { PlaywrightExtractor } from '../../src/browser/playwright-extractor.js';
import type { FigmaNode } from '../../src/contracts/figma/figma-document.js';
import { transformExtractionDocument } from '../../src/figma/transformer.js';
import { startBrowserFixtureServer, type BrowserFixtureServer } from '../fixtures/browser/server.js';

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
