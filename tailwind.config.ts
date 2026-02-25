import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#f0f4ff',
          100: '#e0e9ff',
          500: '#1e3a6e',
          600: '#162d55',
          700: '#0f2040',
          800: '#0a1628',
          900: '#060d18',
        },
      },
    },
  },
  plugins: [],
}

export default config
