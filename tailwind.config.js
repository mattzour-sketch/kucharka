/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Značková barva aplikace – teplá terakota, ladí s jídlem.
        brand: {
          DEFAULT: '#b45309',
          dark: '#92400e',
        },
      },
    },
  },
  plugins: [],
};
