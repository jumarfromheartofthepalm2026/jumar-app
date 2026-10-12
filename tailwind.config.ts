import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        jumar: {
          brown: '#5C3D1E',
          gold: '#C9A84C',
          cream: '#FDF6E3',
          green: '#2D5016',
        }
      },
      fontFamily: {
        arabic: ['Noto Sans Arabic', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
export default config
