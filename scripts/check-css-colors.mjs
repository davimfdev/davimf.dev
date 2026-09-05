/**
 * Recusa cor crua em CSS.
 *
 * O ESLint não analisa CSS, e o projeto tem quatro arquivos `.css`. Sem esta
 * verificação, a garantia anti-hardcode cobriria só metade do código.
 *
 * Stylelint faria o mesmo trabalho, mas traria uma dependência, um arquivo de
 * configuração e um segundo conceito de "regra" para manter - em troca de
 * cobrir quatro arquivos num projeto que quase não escreve CSS novo.
 *
 * `rgb(var(--accent) / .07)` é uso de token e passa: só recusamos as funções de
 * cor quando os argumentos são números literais.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** Único arquivo onde valor cru é legal, por definição. */
const ALLOWED = 'src/styles/tokens.css';

const HEX = /#[0-9a-fA-F]{3,8}\b/;
/** `rgb(` / `hsl(` seguidos de número - `rgb(var(…))` não casa. */
const NUMERIC_FUNCTION = /\b(?:rgba?|hsla?)\(\s*[\d.]/;
/** Nome de cor só conta em posição de valor de propriedade de cor. */
const NAMED_COLOR =
  /(?:^|[\s:;])(?:color|background|background-color|border|border-color|outline|outline-color|fill|stroke|box-shadow|text-shadow)\s*:[^;]*\b(?:white|black|red|blue|green|yellow|orange|purple|pink|gray|grey|silver|maroon|navy|teal|olive|lime|aqua|fuchsia)\b/i;

const ESCAPE = /\/\*\s*allow-raw-color:\s*(.+?)\s*\*\//;

/**
 * Apaga o conteúdo dos comentários preservando as quebras de linha.
 *
 * Hex dentro de comentário é documentação, não valor de cor: o `index.css`
 * registra num comentário que o hover era `#F5F3EF` antes da migração. Um
 * checker que reclamasse disso geraria falso positivo, e falso positivo é como
 * uma regra acaba desligada.
 *
 * Preservar `\n` é o que mantém os números de linha corretos - remover o
 * comentário inteiro deslocaria todo o relatório.
 */
function blankComments(content) {
  return content.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));
}

/**
 * @param {{path: string, content: string}[]} files
 * @returns {{file: string, line: number, text: string}[]}
 */
export function checkCssColors(files) {
  const violations = [];

  for (const { path, content } of files) {
    if (path.split(sep).join('/').endsWith(ALLOWED)) continue;

    const lines = content.split('\n');
    // Detecta sobre o código sem comentários, mas reporta e procura o escape
    // nas linhas originais - o próprio escape é um comentário.
    const code = blankComments(content).split('\n');

    code.forEach((line, index) => {
      const offends = HEX.test(line) || NUMERIC_FUNCTION.test(line) || NAMED_COLOR.test(line);

      if (!offends) return;

      // Escape só vale com motivo escrito na linha imediatamente anterior.
      const previous = index > 0 ? lines[index - 1] : '';
      const escape = previous.match(ESCAPE);
      if (escape && escape[1].trim().length > 0) return;

      // Reporta a linha ORIGINAL: `line` teve os comentários apagados.
      violations.push({ file: path, line: index + 1, text: lines[index].trim() });
    });
  }

  return violations;
}

function collectCssFiles(directory) {
  const found = [];
  for (const entry of readdirSync(directory)) {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) found.push(...collectCssFiles(full));
    else if (entry.endsWith('.css')) found.push(full);
  }
  return found;
}

function main() {
  const files = collectCssFiles(join(ROOT, 'src')).map((path) => ({
    path: relative(ROOT, path),
    content: readFileSync(path, 'utf8'),
  }));

  const violations = checkCssColors(files);

  if (violations.length === 0) {
    console.log(`check-css-colors: ${files.length} arquivo(s) CSS, nenhuma cor crua.`);
    return;
  }

  for (const { file, line, text } of violations) {
    console.error(`${file}:${line}  cor crua  ${text}`);
  }
  console.error(
    `\n${violations.length} cor(es) crua(s) em CSS. Use um token de src/styles/tokens.css, ` +
      `ou justifique com /* allow-raw-color: <motivo> */ na linha anterior.`,
  );
  process.exitCode = 1;
}

// Só executa quando chamado direto, nunca quando importado pelo teste.
if (process.argv[1] && process.argv[1].endsWith('check-css-colors.mjs')) main();
