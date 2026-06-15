/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
     
        'sans': ['"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        'serif': ['Georgia', 'serif']
      },
    },
  },
  plugins: [],
};