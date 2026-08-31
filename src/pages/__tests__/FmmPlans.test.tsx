// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('FmmPlans — badge do Pro', () => {
  it('o badge do Pro reserva espaço em vez de vazar para fora do contêiner', () => {
    // O ancestral é `overflow-x-auto`, e overflow-x: auto força overflow-y: auto
    // — então qualquer coisa posicionada acima da linha é recortada. A correção
    // é reservar espaço no grid, não deslocar o badge para fora dele.
    const source = readFileSync(resolve(__dirname, '../FmmPlans.tsx'), 'utf8');
    expect(source).toContain('grid pt-5');
    expect(source).not.toContain('-top-1');
  });
});
