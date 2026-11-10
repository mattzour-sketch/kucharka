/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Značková barva aplikace – inkoustová modrá (propiska v sešitu receptů).
        // Jediná akční barva; jantar (amber) zůstává jen pro oblíbené a varování.
        brand: {
          DEFAULT: '#2b41b8',
          dark: '#22349a', // hover/stisk, text na světlém tónu
          bright: '#4c62dd', // výplně v tmavém režimu
          light: '#aab7ff', // text a ikony v tmavém režimu
        },
      },
    },
  },
  plugins: [],
};
