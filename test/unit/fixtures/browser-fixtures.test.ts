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
