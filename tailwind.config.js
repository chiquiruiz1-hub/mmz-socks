/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        petrol: {
          50: '#F0F6F8',
          100: '#E1EDF2',
          200: '#B6D6E1',
          300: '#7CB5C9',
          400: '#438EA8',
          DEFAULT: '#1F4D63',
          dark: '#173A4B',
          900: '#0F2631'
        },
        turquoise: {
          light: '#2A9DB8',
          DEFAULT: '#1B7A93',
          dark: '#145D70'
        },
        yarn: {
          coral: '#E36F73',
          mustard: '#F2C14E',
          green: '#4CAF7A',
          slate: '#2B3140'
        },
        ice: '#F2F8FA'
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Clash Display"', '"DM Sans"', 'system-ui', 'sans-serif'],
        serif: ['"Playfair Display"', 'Georgia', 'serif']
      },
      boxShadow: {
        'soft': '0 10px 30px -10px rgba(23, 58, 75, 0.08)',
        'float': '0 20px 40px -15px rgba(23, 58, 75, 0.15)',
        'glow': '0 0 30px rgba(27, 122, 147, 0.25)'
      }
    },
  },
  plugins: [],
}
