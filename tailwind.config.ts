import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        accent: '#FC3F1D',
        'accent-hover': '#E83518',
        surface: {
          light: '#F5F5F5',
          dark: '#2A2A2A',
        },
        bg: {
          light: '#FFFFFF',
          dark: '#1A1A1A',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '16px',
        btn: '12px',
      },
      boxShadow: {
        card: '0 4px 20px rgba(0,0,0,0.08)',
        'card-dark': '0 4px 20px rgba(0,0,0,0.3)',
        'popup': '0 8px 40px rgba(0,0,0,0.15)',
      },
    },
  },
  plugins: [],
}
export default config
