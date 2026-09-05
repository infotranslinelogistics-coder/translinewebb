import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    './portal/src/**/*.{ts,tsx}',
    './portal/index.html',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          raw: '#BE1C2D',
          primary: '#BE1C2D',
          'primary-bright': '#E2485A',
          secondary: '#A6A6A6',
        },
        surface: {
          dark: '#0B0C0D',
          'dark-raised': '#141618',
          light: '#F5F2EB',
          white: '#FFFEFA',
        },
        neutral: {
          100: '#E7E4DC',
          200: '#CDCAC3',
          300: '#A6A6A6',
          500: '#686B6F',
          700: '#35383B',
          900: '#17191B',
        },
        signal: {
          success: '#18794E',
          warning: '#A86408',
          error: '#A61B29',
        },
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        primary: { DEFAULT: 'var(--primary)', foreground: 'var(--primary-foreground)' },
        secondary: { DEFAULT: 'var(--secondary)', foreground: 'var(--secondary-foreground)' },
        destructive: { DEFAULT: 'var(--destructive)', foreground: 'var(--destructive-foreground)' },
        muted: { DEFAULT: 'var(--muted)', foreground: 'var(--muted-foreground)' },
        accent: { DEFAULT: 'var(--accent)', foreground: 'var(--accent-foreground)' },
        popover: { DEFAULT: 'var(--popover)', foreground: 'var(--popover-foreground)' },
        card: { DEFAULT: 'var(--card)', foreground: 'var(--card-foreground)' },
        sidebar: {
          DEFAULT: 'var(--sidebar)',
          foreground: 'var(--sidebar-foreground)',
          primary: 'var(--sidebar-primary)',
          'primary-foreground': 'var(--sidebar-primary-foreground)',
          accent: 'var(--sidebar-accent)',
          'accent-foreground': 'var(--sidebar-accent-foreground)',
          border: 'var(--sidebar-border)',
          ring: 'var(--sidebar-ring)',
        },
      },
      fontFamily: {
        display: ['"Barlow Condensed"', 'Arial Narrow', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        display: ['clamp(4.5rem, 11vw, 10rem)', { lineHeight: '0.82', letterSpacing: '-0.045em', fontWeight: '800' }],
        h1: ['clamp(3.25rem, 7vw, 7rem)', { lineHeight: '0.88', letterSpacing: '-0.035em', fontWeight: '800' }],
        h2: ['clamp(2.5rem, 5vw, 5rem)', { lineHeight: '0.92', letterSpacing: '-0.025em', fontWeight: '700' }],
        h3: ['clamp(1.75rem, 3vw, 2.75rem)', { lineHeight: '1', letterSpacing: '-0.015em', fontWeight: '700' }],
        h4: ['1.25rem', { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '600' }],
        body: ['1rem', { lineHeight: '1.65' }],
        caption: ['0.75rem', { lineHeight: '1.4', letterSpacing: '0.08em' }],
        data: ['0.875rem', { lineHeight: '1.4', letterSpacing: '0.02em' }],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
}

export default config
