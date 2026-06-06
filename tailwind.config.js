/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0A0A0A',
        surface: '#121211',
        accent: {
          DEFAULT: '#E6B566',
          soft: '#F0CF95',
          dim: '#A8854A',
        },
      },
      fontFamily: {
        sans: ['Satoshi', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Cabinet Grotesk"', 'Satoshi', 'ui-sans-serif', 'sans-serif'],
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
