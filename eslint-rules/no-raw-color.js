/**
 * Recusa cor crua em JS/TS/TSX.
 *
 * A verificação irmã para CSS mora em `scripts/check-css-colors.mjs`; juntas
 * elas cobrem as duas linguagens onde cor pode aparecer no projeto.
 *
 * A isenção é por DECLARAÇÃO, nunca por arquivo: um literal só é aceito dentro
 * de uma variável cujo nome case /^DATA_PALETTE(_|$)/. Isentar um arquivo
 * inteiro deixaria passar cromo de interface no mesmo arquivo — o padrão que
 * `src/lib/palettes/dataPalettes.ts` isola de propósito.
 */

const HEX = /#[0-9a-fA-F]{3,8}\b/;

const TAILWIND_PALETTE =
  /\b(?:text|bg|border|ring|from|via|to|decoration|outline|shadow|fill|stroke)-(?:red|green|blue|yellow|amber|violet|purple|pink|indigo|emerald|teal|cyan|sky|rose|fuchsia|lime|orange|gray|slate|zinc|neutral|stone)-\d{2,3}\b/;

const ARBITRARY_COLOR = /-\[(?:#|rgb|hsl)|-(?:white|black)\//;

/** `rgb(` / `hsl(` seguidos de número. `rgb(var(--accent) / .5)` NÃO casa. */
const NUMERIC_FUNCTION = /\b(?:rgba?|hsla?)\(\s*[\d.]/;

/** Sugere o token da tabela §6.2 do spec para os casos mais comuns. */
const SUGGESTIONS = [
  [/-(?:red|rose)-\d{2,3}/, 'danger'],
  [/-(?:green|emerald|teal)-\d{2,3}/, 'ok'],
  [/-(?:yellow|amber)-\d{2,3}/, 'warn'],
  [/-gray-(?:100|200)\b/, 'fg'],
  [/-gray-300\b/, 'fg-soft (prosa) ou fg-muted (rótulo)'],
  [/-gray-(?:400|500|600)\b/, 'fg-muted'],
  [/-white\//, 'surface-1/2/3 ou line/line-strong'],
];

function suggest(text) {
  for (const [pattern, token] of SUGGESTIONS) {
    if (pattern.test(text)) return token;
  }
  return null;
}

/** A declaração `DATA_PALETTE_*` mais próxima, se houver. */
function insideDataPalette(node) {
  for (let current = node.parent; current; current = current.parent) {
    if (current.type === 'VariableDeclarator') {
      return current.id.type === 'Identifier' && /^DATA_PALETTE(_|$)/.test(current.id.name);
    }
  }
  return false;
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Cor de interface vem de token. Cor que é dado vive numa constante DATA_PALETTE_*.',
    },
    schema: [],
    messages: {
      rawHex:
        'Cor crua "{{value}}". Use um token do design system (src/styles/tokens.css). Cor que é dado vai numa constante DATA_PALETTE_*.',
      tailwindPalette:
        'Paleta padrão do Tailwind em "{{value}}"{{hint}}. O site usa apenas os tokens do design system.',
      arbitraryColor:
        'Valor de cor arbitrário em "{{value}}"{{hint}}. Use um token do design system.',
      rawFunction:
        'Função de cor com valores crus em "{{value}}". Use um token do design system — `rgb(var(--token) / alfa)` compõe alfa a partir do token.',
    },
  },

  create(context) {
    function check(node, text) {
      if (insideDataPalette(node)) return;

      const value = text.length > 60 ? `${text.slice(0, 57)}…` : text;
      const token = suggest(text);
      const hint = token ? ` — use ${token}` : '';

      if (TAILWIND_PALETTE.test(text)) {
        context.report({ node, messageId: 'tailwindPalette', data: { value, hint } });
      }
      if (ARBITRARY_COLOR.test(text)) {
        context.report({ node, messageId: 'arbitraryColor', data: { value, hint } });
      }
      if (NUMERIC_FUNCTION.test(text)) {
        context.report({ node, messageId: 'rawFunction', data: { value, hint } });
      }
      // Um hex dentro de `-[#…]` já foi reportado como arbitrário; não duplica.
      if (HEX.test(text) && !ARBITRARY_COLOR.test(text)) {
        context.report({ node, messageId: 'rawHex', data: { value, hint } });
      }
    }

    return {
      Literal(node) {
        if (typeof node.value === 'string') check(node, node.value);
      },
      TemplateElement(node) {
        if (node.value && typeof node.value.raw === 'string') check(node, node.value.raw);
      },
    };
  },
};
