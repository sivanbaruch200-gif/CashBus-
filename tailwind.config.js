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
        primary: {
          orange: '#FF8C00',
          navy: '#1E3A8A',
          white: '#FFFFFF',
        },
        status: {
          pending: '#FCD34D',
          approved: '#10B981',
          rejected: '#EF4444',
          legal: '#6366F1',
          verified: '#10B981',
        },
      },
      fontFamily: {
        sans: ['Assistant', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
