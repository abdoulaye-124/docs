/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        teranga: {
          50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 500: '#10b981',
          600: '#059669', 700: '#047857', 800: '#065f46', 900: '#064e3b',
        },
        soleil: { 100: '#fef3c7', 400: '#fbbf24', 500: '#f59e0b', 700: '#b45309' },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Noto Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
