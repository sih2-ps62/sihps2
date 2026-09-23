/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        base: {
          950: '#070b14',
          900: '#0b1220',
          850: '#0f1729',
          800: '#141d33',
          700: '#1c2740',
          600: '#2a3654',
        },
        accent: {
          500: '#4f46e5',
          400: '#6366f1',
        },
      },
    },
  },
  plugins: [],
}
