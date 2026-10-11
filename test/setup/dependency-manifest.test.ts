import { readFile } from 'node:fs/promises';
import { expect, test } from 'vitest';

interface PackageManifest {
  dependencies?: Record<string, string>;
  figmify?: {
    dependencyJustifications?: Record<string, string>;
  };
}

test('declares and justifies the required runtime dependencies', async () => {
  const manifest = JSON.parse(
    await readFile(new URL('../../package.json', import.meta.url), 'utf8'),
  ) as PackageManifest;

  for (const dependency of ['fastify', 'playwright']) {
    expect(manifest.dependencies?.[dependency]).toBeDefined();
    expect(manifest.figmify?.dependencyJustifications?.[dependency]).toMatch(/\S/);
  }
});
