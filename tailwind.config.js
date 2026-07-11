module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        cyan: {
          300: '#67E8F9',
          400: '#00E5FF',
          500: '#06B6D4',
          DEFAULT: '#00E5FF',
        },
        primary: '#0b1020',
      },
      fontFamily: {
        display: ['Inter', 'ui-sans-serif', 'system-ui'],
        montserrat: ['Montserrat', 'ui-sans-serif', 'system-ui'],
      },
      backgroundImage: {
        'radial-soft': 'radial-gradient(ellipse at center, rgba(59,130,246,0.06), transparent 40%)',
      },
    },
  },
  plugins: [],
}
