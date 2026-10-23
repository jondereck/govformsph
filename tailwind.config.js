/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: {
          light: '#FFFFFF',
          dark: '#0F172A',
        },
        band: '#111111',
        ink: '#1A1A2E',
        surface: {
          light: '#FFFFFF',
          dark: '#1E293B',
          cardDark: '#1E293B',
        },
        border: {
          light: '#E2E8F0',
          dark: '#334155',
        },
        primary: {
          50: '#F0F4FF',
          100: '#E4ECFF',
          200: '#C9D8FF',
          300: '#9BB4FF',
          400: '#5C82F5',
          500: '#0040E7',
          600: '#0040E7',
          700: '#0035C4',
          800: '#0047AB',
          900: '#002D6B',
          950: '#001A4D',
        },
        teal: {
          50: '#F0F4FF',
          100: '#E4ECFF',
          200: '#C9D8FF',
          300: '#9BB4FF',
          400: '#5C82F5',
          500: '#0040E7',
          600: '#0040E7',
          700: '#0035C4',
          800: '#0047AB',
          900: '#002D6B',
          950: '#001A4D',
        }
      },
      fontFamily: {
        sans: [
          '"Lexend"',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
        mono: [
          '"JetBrains Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
      screens: {
        'xs': '375px',
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1440px',
      }
    },
  },
  plugins: [],
}
