/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eff9ff',
          100: '#dff3ff',
          200: '#b7e8ff',
          300: '#77d7ff',
          400: '#38c5f5',
          500: '#0eaada',
          600: '#0889b2',
          700: '#0b6e91',
          800: '#105c77',
          900: '#134d63',
        },
        dark: {
          900: '#f0f5fb',
          800: '#ffffff',
          700: '#f8fafc',
          600: '#e2e8f0',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
