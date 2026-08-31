import { describe, expect, it } from 'vitest';
import { checkCssColors } from '../check-css-colors.mjs';

const file = (content: string) => [{ path: 'src/fake.css', content }];

describe('checkCssColors', () => {
  it('recusa hex', () => {
    const found = checkCssColors(file('.a { color: #fff; }'));
    expect(found).toHaveLength(1);
    expect(found[0].line).toBe(1);
  });

  it('recusa rgb e rgba com números literais', () => {
    expect(checkCssColors(file('.a { color: rgba(230, 181, 102, .5); }'))).toHaveLength(1);
    expect(checkCssColors(file('.a { color: rgb(0,0,0); }'))).toHaveLength(1);
  });

  it('recusa hsl com números literais', () => {
    expect(checkCssColors(file('.a { color: hsl(30, 70%, 50%); }'))).toHaveLength(1);
  });

  it('recusa nome de cor CSS em propriedade de cor', () => {
    expect(checkCssColors(file('.a { background: white; }'))).toHaveLength(1);
    expect(checkCssColors(file('.a { border: 1px solid black; }'))).toHaveLength(1);
  });

  /** Sem isto, o dashboard.css não poderia usar as 14 variações de alfa do accent. */
  it('ACEITA rgb(var(--token) / alfa) — é uso de token, não cor crua', () => {
    expect(checkCssColors(file('.a { color: rgb(var(--accent) / .07); }'))).toHaveLength(0);
    expect(checkCssColors(file('.a { background: rgb(var(--surface-1)); }'))).toHaveLength(0);
  });

  it('aceita var() puro', () => {
    expect(checkCssColors(file('.a { border-color: var(--line); }'))).toHaveLength(0);
  });

  it('não confunde palavra em comentário ou nome de classe', () => {
    expect(checkCssColors(file('/* fundo white antigo */\n.white-box { padding: 4px; }'))).toHaveLength(0);
  });

  /**
   * O `index.css` documenta num comentário que o hover era `#F5F3EF` antes da
   * migração. Hex em comentário é documentação, não valor de cor — e um checker
   * que não distingue os dois vira gerador de falso positivo, que é como uma
   * regra acaba desligada.
   */
  it('ignora cor citada dentro de comentário de bloco multi-linha', () => {
    const content = [
      '/**',
      ' * O hover era `bg-white` sobre um `#F5F3EF` de base.',
      ' * Também citava rgba(255, 255, 255, .07).',
      ' */',
      '.a { color: var(--fg); }',
    ].join('\n');
    expect(checkCssColors(file(content))).toHaveLength(0);
  });

  it('mantém o número de linha correto depois de um bloco de comentário', () => {
    const content = ['/**', ' * #F5F3EF histórico', ' */', '.a { color: #fff; }'].join('\n');
    const found = checkCssColors(file(content));
    expect(found).toHaveLength(1);
    expect(found[0].line).toBe(4);
  });

  it('aceita quando a linha anterior justifica o escape', () => {
    const content = '/* allow-raw-color: gradiente de marca do parceiro */\n.a { color: #fff; }';
    expect(checkCssColors(file(content))).toHaveLength(0);
  });

  it('recusa escape sem motivo escrito', () => {
    const content = '/* allow-raw-color: */\n.a { color: #fff; }';
    expect(checkCssColors(file(content))).toHaveLength(1);
  });

  it('isenta tokens.css, que é a fonte de verdade', () => {
    const tokens = [{ path: 'src/styles/tokens.css', content: ':root { --bg: 7 7 7; --line: rgba(255,255,255,.08); }' }];
    expect(checkCssColors(tokens)).toHaveLength(0);
  });
});
