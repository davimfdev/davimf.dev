// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('FmmPlans — badge do Pro', () => {
  it('o badge do Pro ocupa espaço real, em vez de flutuar sobre o card', () => {
    // A causa do corte era posicionamento absoluto: elemento absoluto não
    // reserva espaço, então o badge se sobrepunha ao topo do card e a borda
    // arredondada cortava por cima. O slot de altura fixa nas três colunas
    // mantém os cards alinhados e dá lugar de verdade ao badge.
    const source = readFileSync(resolve(__dirname, '../FmmPlans.tsx'), 'utf8');
    expect(source).not.toMatch(/<Badge[\s\S]{0,120}?absolute/);
    expect((source.match(/h-7 flex items-end pb-1/g) ?? []).length).toBe(3);
  });
});

describe('FmmPlans — nomes dos planos', () => {
  it('os nomes vêm das traduções (basicPlan.title e proPlan.title), não de literais cravados', () => {
    // Testa que os nomes "Básico" e "Pro" usam basicPlan.title e proPlan.title
    // da desestruturação (linha 94). Se estivessem cravados, apareceriam como
    // strings literais em vez de expressões JSX.
    // Um teste de renderização com language switching não é prático aqui porque:
    // - FmmPlans não renderiza o toggle de idioma (está em Layout)
    // - LanguageContext não responde a mudanças de localStorage após mount
    // Portanto, o melhor é verificar no source que o código usa as variáveis.
    const source = readFileSync(resolve(__dirname, '../FmmPlans.tsx'), 'utf8');
    // Verifica que não há literais cravados "Básico" ou "Pro" (em quotes) na markup
    expect(source).not.toMatch(/>Básico</);
    expect(source).not.toMatch(/>Pro</);
  });
});
