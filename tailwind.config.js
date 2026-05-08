/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.{js,ts,tsx}', './src/**/*.{js,ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        accent: '#01BAEF',
        bg: {
          DEFAULT: '#F9F7F5',
          dark: '#0E0E0F',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          dark: '#1A1A1B',
        },
        ink: {
          DEFAULT: '#1A1A1A',
          dark: '#FFFFFF',
        },
        muted: {
          DEFAULT: '#717171',
          dark: '#888888',
        },
      },
      fontFamily: {
        sans: ['System'],
      },
    },
  },
  plugins: [],
};
