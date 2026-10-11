import { readFile } from 'node:fs/promises';
import { expect, test } from 'vitest';

test('documents the versioned operational startup contract', async () => {
  const specification = await readFile(
    new URL('../../specs/001-figmifyapi-mvp/spec.md', import.meta.url),
    'utf8',
  );

  expect(specification).toContain('## Contrato operativo de arranque');
  expect(specification).toMatch(/`HOST`.*`127\.0\.0\.1`/s);
  expect(specification).toMatch(/`PORT`.*`3000`/s);
  expect(specification).toMatch(/`PORT`.*1.*65535/s);
  expect(specification).toMatch(/no abrirá ningún puerto/i);
  expect(specification).toMatch(/código de salida distinto de cero/i);
});
