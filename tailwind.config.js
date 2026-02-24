/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Core surface colors (dark theme)
        surface: {
          base: '#0A0A0B',
          raised: '#111113',
          overlay: '#1A1A1D',
          border: '#27272A',
          'border-light': '#3F3F46',
        },
        // Text colors
        content: {
          primary: '#FAFAFA',
          secondary: '#A1A1AA',
          tertiary: '#71717A',
          inverse: '#0A0A0B',
        },
        // Accent: Amber (domesticated orange)
        accent: {
          DEFAULT: '#D97706',
          light: '#F59E0B',
          muted: '#92400E',
          surface: 'rgba(217, 119, 6, 0.1)',
          border: 'rgba(217, 119, 6, 0.3)',
        },
        // Status colors (refined for dark theme)
        status: {
          pending: '#FBBF24',
          'pending-surface': 'rgba(251, 191, 36, 0.1)',
          approved: '#34D399',
          'approved-surface': 'rgba(52, 211, 153, 0.1)',
          rejected: '#F87171',
          'rejected-surface': 'rgba(248, 113, 113, 0.1)',
          legal: '#818CF8',
          'legal-surface': 'rgba(129, 140, 248, 0.1)',
          verified: '#34D399',
        },
        // Stat card number color
        gold: {
          DEFAULT: '#E5D5B0',
          dim: '#B8A88A',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Assistant', 'system-ui', 'sans-serif'],
      },
      backdropBlur: {
        glass: '20px',
      },
      boxShadow: {
        glass: '0 4px 30px rgba(0, 0, 0, 0.3)',
        'glass-lg': '0 8px 40px rgba(0, 0, 0, 0.4)',
        'accent-glow': '0 0 20px rgba(217, 119, 6, 0.15)',
        'card-hover': '0 8px 25px rgba(0, 0, 0, 0.3)',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        shimmer: 'shimmer 2.5s linear infinite',
      },
    },
  },
  plugins: [],
}
