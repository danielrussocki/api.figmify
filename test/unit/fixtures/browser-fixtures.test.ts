import { describe, expect, test } from 'vitest';

import { startBrowserFixtureServer } from '../../fixtures/browser/server.js';

describe('browser fixtures', () => {
  test('serve a controlled page with all browser extraction scenarios', async () => {
    const fixtureServer = await startBrowserFixtureServer();

    try {
      const response = await fetch(`${fixtureServer.url}/browser-fixtures.html`);
      const document = await response.text();

      expect(response.status).toBe(200);
      expect(document).toContain('id="visible-text"');
      expect(document).toContain('id="hidden-attribute"');
      expect(document).toContain('id="hidden-display"');
      expect(document).toContain('id="pseudo-element"');
      expect(document).toContain('id="open-shadow-host"');
      expect(document).toContain('id="closed-shadow-host"');
      expect(document).toContain('id="fixture-iframe"');
      expect(document).toContain('id="async-content"');
      expect(document).toContain('/resources/failed-image.png');
      expect(document).toContain('/resources/secondary-redirect.css');
      expect(document).toContain('name="fixture-metadata"');
      expect(document).toContain('id="hidden-opacity"');
      expect(document).toContain('id="zero-size"');
      expect(document).toContain('id="fixed-position"');
      expect(document).toContain('id="fixture-svg"');
      expect(document).toContain('display: none');
      expect(document).toContain('opacity: 0');
      expect(document).toContain('position: fixed');
      expect(document).toContain('width="80" height="40"');
    } finally {
      await fixtureServer.close();
    }
  });

  test('serve fixtures for mixed text runs, layout modes, and image representations', async () => {
    const fixtureServer = await startBrowserFixtureServer();

    try {
      const response = await fetch(`${fixtureServer.url}/browser-fixtures.html`);
      const document = await response.text();

      expect(response.status).toBe(200);
      expect(document).toContain('id="mixed-text-runs"');
      expect(document).toContain('id="mixed-text-regular"');
      expect(document).toContain('id="mixed-text-emphasis"');
      expect(document).toContain('id="mixed-text-strong"');
      expect(document).toContain('id="flex-layout"');
      expect(document).toContain('id="grid-layout"');
      expect(document).toContain('gap: normal');
      expect(document).toContain('id="fixture-image"');
      expect(document).toContain('src="/resources/fixture-image.svg"');
      expect(document).toContain('id="background-image"');
      expect(document).toContain('background-image: url("/resources/fixture-image.svg")');
      expect(document).toContain('id="inline-svg"');
      expect(document).toContain('<circle');

      const image = await fetch(`${fixtureServer.url}/resources/fixture-image.svg`);
      expect(image.status).toBe(200);
      expect(image.headers.get('content-type')).toContain('image/svg+xml');
    } finally {
      await fixtureServer.close();
    }
  });

  test('serves horizontal and vertical flex Auto Layout scenarios with effective spacing', async () => {
    const fixtureServer = await startBrowserFixtureServer();

    try {
      const response = await fetch(`${fixtureServer.url}/browser-fixtures.html`);
      const document = await response.text();

      expect(response.status).toBe(200);
      expect(document).toContain('id="flex-auto-layout-horizontal"');
      expect(document).toContain('flex-direction: row');
      expect(document).toContain('gap: 12px');
      expect(document).toContain('padding: 8px 16px 24px 32px');
      expect(document).toContain('justify-content: space-between');
      expect(document).toContain('align-items: center');
      expect(document).toContain('id="flex-horizontal-growing-item"');
      expect(document).toContain('flex-grow: 1');
      expect(document).toContain('id="flex-auto-layout-vertical"');
      expect(document).toContain('flex-direction: column');
      expect(document).toContain('gap: 10px');
      expect(document).toContain('padding: 4px 12px 20px 28px');
      expect(document).toContain('justify-content: flex-end');
      expect(document).toContain('align-items: flex-start');
      expect(document).toContain('id="flex-vertical-growing-item"');
    } finally {
      await fixtureServer.close();
    }
  });

  test('serves grid Auto Layout and non-equivalent alignment scenarios', async () => {
    const fixtureServer = await startBrowserFixtureServer();

    try {
      const response = await fetch(`${fixtureServer.url}/browser-fixtures.html`);
      const document = await response.text();

      expect(response.status).toBe(200);
      expect(document).toContain('id="grid-auto-layout-column-flow"');
      expect(document).toContain('grid-auto-flow: column');
      expect(document).toContain('row-gap: 6px');
      expect(document).toContain('column-gap: 18px');
      expect(document).toContain('id="grid-auto-layout-row-flow"');
      expect(document).toContain('grid-auto-flow: row');
      expect(document).toContain('row-gap: 14px');
      expect(document).toContain('column-gap: 4px');
      expect(document).toContain('id="grid-auto-layout-normal-gap"');
      expect(document).toContain('gap: normal');
      expect(document).toContain('id="flex-auto-layout-row-reverse"');
      expect(document).toContain('flex-direction: row-reverse');
      expect(document).toContain('id="flex-auto-layout-column-reverse"');
      expect(document).toContain('flex-direction: column-reverse');
      expect(document).toContain('id="alignment-space-around"');
      expect(document).toContain('justify-content: space-around');
      expect(document).toContain('align-items: stretch');
      expect(document).toContain('id="alignment-space-evenly"');
      expect(document).toContain('justify-content: space-evenly');
      expect(document).toContain('align-items: baseline');
    } finally {
      await fixtureServer.close();
    }
  });

  test('serve failed resources and redirect secondary resources without redirecting the document', async () => {
    const fixtureServer = await startBrowserFixtureServer();

    try {
      const [failedResource, redirectedResource, iframe] = await Promise.all([
        fetch(`${fixtureServer.url}/resources/failed-image.png`, { redirect: 'manual' }),
        fetch(`${fixtureServer.url}/resources/secondary-redirect.css`, { redirect: 'manual' }),
        fetch(`${fixtureServer.url}/iframe.html`),
      ]);

      expect(failedResource.status).toBe(404);
      expect(redirectedResource.status).toBe(302);
      expect(redirectedResource.headers.get('location')).toBe('/resources/stylesheet.css');
      expect(iframe.status).toBe(200);
      await expect(iframe.text()).resolves.toContain('Iframe-only content');
    } finally {
      await fixtureServer.close();
    }
  });
});
