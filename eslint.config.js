import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import noRawColor from './eslint-rules/no-raw-color.js';

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      local: { rules: { 'no-raw-color': noRawColor } },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // Cor de interface vem de token; cor que é dado vive numa constante
      // DATA_PALETTE_*. Ver src/styles/tokens.css e spec §8.1.
      'local/no-raw-color': 'error',
    },
  },
  {
    // Num teste, o literal de cor É a asserção — RoleChip.test.tsx afirma
    // `expect(roleColorToHex(0x5865f2)).toBe('#5865f2')`. Exigir uma constante
    // DATA_PALETTE_ ali pioraria o teste para satisfazer a regra.
    //
    // Esta é a única isenção por padrão de arquivo do projeto, e ela só é
    // aceitável porque arquivo de teste não renderiza cromo do site. A isenção
    // de cor-que-é-dado em código de produção continua sendo por declaração.
    files: ['**/*.test.{ts,tsx}', '**/__tests__/**'],
    rules: { 'local/no-raw-color': 'off' },
  }
);
