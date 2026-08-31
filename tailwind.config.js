/** @type {import('tailwindcss').Config} */

/**
 * Os valores vivem em `src/styles/tokens.css`. Este arquivo só os expõe como
 * classes. `<alpha-value>` é o que faz `text-accent/30` funcionar — por isso
 * os tokens opacos guardam canais em vez de hex.
 */
const withAlpha = (token) => `rgb(var(--${token}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: withAlpha('bg'),
        surface: {
          1: withAlpha('surface-1'),
          2: withAlpha('surface-2'),
          3: withAlpha('surface-3'),
          // Translúcido por natureza (a nav precisa de backdrop-blur):
          // não aceita modificador de opacidade.
          nav: 'var(--surface-nav)',
        },
        fg: {
          DEFAULT: withAlpha('fg'),
          soft: withAlpha('fg-soft'),
          muted: withAlpha('fg-muted'),
        },
        accent: {
          DEFAULT: withAlpha('accent'),
          bright: withAlpha('accent-bright'),
          // DEPRECATED: aliases mantidos só até a Task 12 migrar os 28 usos.
          soft: withAlpha('accent-bright'),
          dim: withAlpha('accent'),
        },
        danger: withAlpha('danger'),
        ok: withAlpha('ok'),
        warn: withAlpha('warn'),
        line: {
          DEFAULT: 'var(--line)',
          strong: 'var(--line-strong)',
        },
        print: {
          bg: withAlpha('print-bg'),
          fg: withAlpha('print-fg'),
        },
        // DEPRECATED: alias de `bg`, mantido só até a Task 10 migrar os 16 usos.
        ink: withAlpha('bg'),
      },
      borderRadius: {
        chip: 'var(--r-sm)',
        control: 'var(--r-md)',
        panel: 'var(--r-lg)',
      },
      fontSize: {
        'display-1': ['var(--t-display-1)', { lineHeight: '1.02', letterSpacing: '-0.035em' }],
        'display-2': ['var(--t-display-2)', { lineHeight: '1.06', letterSpacing: '-0.03em' }],
        'display-3': ['var(--t-display-3)', { lineHeight: '1.12', letterSpacing: '-0.025em' }],
        'display-4': ['var(--t-display-4)', { lineHeight: '1.2', letterSpacing: '-0.015em' }],
        eyebrow: ['var(--t-eyebrow)', { lineHeight: '1.45', letterSpacing: '0.08em' }],
      },
      fontFamily: {
        sans: ['Satoshi', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Cabinet Grotesk"', 'Satoshi', 'ui-sans-serif', 'sans-serif'],
      },
      maxWidth: {
        content: 'var(--maxw-content)',
        wide: 'var(--maxw-wide)',
        prose: 'var(--maxw-prose)',
      },
      spacing: {
        gutter: 'var(--gutter)',
        section: 'var(--section-y)',
      },
      transitionDuration: {
        fast: 'var(--dur-fast)',
        base: 'var(--dur)',
        slow: 'var(--dur-slow)',
      },
      transitionTimingFunction: {
        'out-token': 'var(--ease-out)',
        'in-out-token': 'var(--ease-in-out)',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
