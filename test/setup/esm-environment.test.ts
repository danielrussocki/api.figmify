import { expect, test } from 'vitest';

test('runs TypeScript tests as ESM', () => {
  expect(import.meta.url).toMatch(/esm-environment\.test\.ts$/);
});
