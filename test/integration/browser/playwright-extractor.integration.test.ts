import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';

import { PlaywrightExtractor } from '../../../src/browser/playwright-extractor.js';
import type { ExtractionNode, Viewport } from '../../../src/contracts/extraction/extraction-document.js';
import { transformExtractionNode } from '../../../src/figma/transformer.js';
import { PublicUrlPolicy } from '../../../src/security/url-policy/public-url-policy.js';
import { startBrowserFixtureServer, type BrowserFixtureServer } from '../../fixtures/browser/server.js';

const requestViewport = {
  width: 1280,
  height: 720,
  deviceScaleFactor: 1,
} satisfies Viewport;

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

describe('PlaywrightExtractor integration', () => {
  test('waits after load before serializing the asynchronous fixture', async () => {
    const requestedDelays: number[] = [];
    await shortenPostLoadWait(requestedDelays);
    const extractor = new PlaywrightExtractor(browser, 'development');

    const document = await extractor.extract({
      url: `${fixtureServer.url}/browser-fixtures.html`,
      viewport: requestViewport,
    });

    expect(requestedDelays).toEqual([30_000]);
    expect(findNodeById(document.document, 'async-content')).toMatchObject({
      text: null,
      directTextRuns: [{ characters: 'Asynchronous fixture text', childNodeIndex: 0 }],
    });
  });

  test.each([
    ['HTTP', '/redirect/http'],
    ['meta refresh', '/redirect/meta-refresh'],
    ['JavaScript', '/redirect/javascript'],
  ])('rejects a %s main document redirect', async (_, path) => {
    await shortenPostLoadWait();
    const extractor = new PlaywrightExtractor(browser, 'development');

    await expect(extractor.extract({
      url: `${fixtureServer.url}${path}`,
      viewport: requestViewport,
    })).rejects.toMatchObject({
      code: 'REDIRECT_NOT_ALLOWED',
      message: 'The main document navigation must not redirect.',
    });
  });

  test('classifies an unsuccessful main document response as an upstream failure', async () => {
    const extractor = new PlaywrightExtractor(browser, 'development');

    await expect(extractor.extract({
      url: `${fixtureServer.url}/errors/upstream`,
      viewport: requestViewport,
    })).rejects.toMatchObject({
      code: 'UPSTREAM_FAILURE',
      message: 'The upstream site could not be processed.',
    });
  });

  test('blocks a DNS-resolved non-public main document destination in production', async () => {
    const policy = new PublicUrlPolicy(async (hostname) => {
      expect(hostname).toBe('internal.example');
      return ['fd00::1'];
    });
    const extractor = new PlaywrightExtractor(browser, 'production', policy);

    await expect(extractor.extract({
      url: 'https://internal.example/private',
      viewport: requestViewport,
    })).rejects.toMatchObject({
      code: 'URL_NOT_PUBLIC',
      message: 'The URL must resolve to a public address.',
    });
  });

  test('continues after failed and redirected secondary resources without traversing the iframe', async () => {
    await shortenPostLoadWait();
    const extractor = new PlaywrightExtractor(browser, 'development');

    const document = await extractor.extract({
      url: `${fixtureServer.url}/browser-fixtures.html`,
      viewport: requestViewport,
    });
    const iframe = findNodeById(document.document, 'fixture-iframe');

    expect(document.schemaVersion).toBe('1.0');
    expect(findNodeById(document.document, 'failed-resource')).toBeDefined();
    expect(findNodeById(document.document, 'visible-text')?.styles['font-weight']).toBe('700');
    expect(iframe).toMatchObject({ tagName: 'iframe', children: [] });
    expect(JSON.stringify(iframe)).not.toContain('Iframe-only content');
  });

  test('transforms a resolvable background image into a FRAME paint', async () => {
    await shortenPostLoadWait();
    const extractor = new PlaywrightExtractor(browser, 'development');

    const document = await extractor.extract({
      url: `${fixtureServer.url}/browser-fixtures.html`,
      viewport: requestViewport,
    });
    const background = findNodeById(document.document, 'background-image');

    expect(background).toBeDefined();
    expect(transformExtractionNode(background as ExtractionNode)).toMatchObject({
      type: 'FRAME',
      fills: [{
        type: 'IMAGE',
        src: `${fixtureServer.url}/resources/fixture-image.svg`,
        scaleMode: 'FILL',
      }],
    });
  });

  test('preserves complete inline SVG markup including graphical descendants and attributes', async () => {
    await shortenPostLoadWait();
    const extractor = new PlaywrightExtractor(browser, 'development');

    const document = await extractor.extract({
      url: `${fixtureServer.url}/browser-fixtures.html`,
      viewport: requestViewport,
    });
    const svg = findNodeById(document.document, 'inline-svg');

    expect(svg?.svg).toContain('<svg');
    expect(svg?.svg).toContain('viewBox="0 0 64 48"');
    expect(svg?.svg).toContain('<circle');
    expect(svg?.svg).toContain('cx="24"');
    expect(svg?.svg).toContain('cy="24"');
    expect(svg?.svg).toContain('r="16"');
    expect(svg?.svg).toContain('fill="rgb(20, 80, 160)"');
    expect(svg?.resources).toEqual([]);
  });

  test('collects accessible @font-face families, weights, and resolved HTTP(S) URLs without failing on cross-origin stylesheets', async () => {
    await shortenPostLoadWait();
    const extractor = new PlaywrightExtractor(browser, 'development');

    const document = await extractor.extract({
      url: `${fixtureServer.url}/browser-fixtures.html`,
      viewport: requestViewport,
    });

    expect(document.fontFaceSources).toEqual([
      {
        family: 'Fixture Sans',
        weight: 700,
        url: `${fixtureServer.url}/resources/fixture-font.woff2`,
      },
      {
        family: 'Hidden Fixture Sans',
        weight: 400,
        url: `${fixtureServer.url}/resources/hidden-fixture-font.woff2`,
      },
    ]);
    expect(document.fontFaceSources).not.toContainEqual(expect.objectContaining({ family: 'Cross Origin Font' }));
  });

  test('keeps only determinable HTTP(S) font-face URLs from accessible stylesheets', async () => {
    await shortenPostLoadWait();
    const extractor = new PlaywrightExtractor(browser, 'development');

    const document = await extractor.extract({
      url: `${fixtureServer.url}/browser-fixtures.html`,
      viewport: requestViewport,
    });

    expect(document.fontFaceSources).toEqual(expect.arrayContaining([
      {
        family: 'Hidden Fixture Sans',
        weight: 400,
        url: `${fixtureServer.url}/resources/hidden-fixture-font.woff2`,
      },
    ]));
    expect(document.fontFaceSources).not.toContainEqual(expect.objectContaining({
      family: 'Undetermined Fixture Sans',
    }));
  });

  test('preserves ordered direct text runs without duplicating mixed text and omits hidden text runs', async () => {
    await shortenPostLoadWait();
    const extractor = new PlaywrightExtractor(browser, 'development');

    const document = await extractor.extract({
      url: `${fixtureServer.url}/browser-fixtures.html`,
      viewport: requestViewport,
    });
    const mixed = findNodeById(document.document, 'direct-mixed-text');
    const hidden = findNodeById(document.document, 'hidden-text-subtree');

    expect(mixed).toMatchObject({
      text: null,
      directTextRuns: [
        { characters: 'Hello ', childNodeIndex: 0, styles: { 'font-size': '16px' } },
        { characters: ' again', childNodeIndex: 2, styles: { 'font-size': '16px' } },
      ],
      children: [{
        attributes: { id: 'direct-text-emphasis' },
        text: null,
        directTextRuns: [{ characters: 'world', childNodeIndex: 0 }],
      }],
    });
    expect(JSON.stringify(mixed)).not.toContain('Hello world again');
    expect(hidden).toMatchObject({ text: null, children: [{ text: null }] });
    expect(hidden).not.toHaveProperty('directTextRuns');
  });
});

async function shortenPostLoadWait(requestedDelays: number[] = []): Promise<void> {
  const newContext = browser.newContext.bind(browser);
  vi.spyOn(browser, 'newContext').mockImplementation(async (...arguments_) => {
    const context = await newContext(...arguments_);
    context.on('page', (page) => {
      vi.spyOn(page, 'waitForTimeout').mockImplementation(async (timeout) => {
        requestedDelays.push(timeout);
        await new Promise((resolve) => setTimeout(resolve, 150));
      });
    });
    return context;
  });
}

function findNodeById(node: ExtractionNode, id: string): ExtractionNode | undefined {
  if (node.attributes.id === id) {
    return node;
  }

  for (const child of [...node.children, ...(node.shadowChildren ?? [])]) {
    const match = findNodeById(child, id);
    if (match !== undefined) {
      return match;
    }
  }

  return undefined;
}
