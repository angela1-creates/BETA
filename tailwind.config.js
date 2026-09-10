/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#17201d',
        paper: '#f4f2ed',
        moss: '#315c4d',
        coral: '#e76f51',
        cobalt: '#356a9a',
        sand: '#ded8cc'
      },
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      boxShadow: { soft: '0 18px 50px rgba(28, 38, 34, .10)' }
    }
  },
  plugins: []
}
