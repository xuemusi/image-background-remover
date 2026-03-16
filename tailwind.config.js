/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef9ff',
          100: '#d8f0ff',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          950: '#082f49',
        },
      },
      boxShadow: {
        soft: '0 20px 60px rgba(14, 165, 233, 0.12)',
      },
    },
  },
  plugins: [],
}
