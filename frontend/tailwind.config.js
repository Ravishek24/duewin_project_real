/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,js}"],
  theme: {
    extend: {
      colors: {
        'custom-pink': '#ff4053', // Add your custom color here
        'custom-dark-pink': '#ff4044',
        'custom-light-pink': '#ff5353',
        'custom-blue': '#13052E',
        'custom-dark-blue': '#100722',
        'custom-dark-blue': '#001440',
      },
    },
  },
  plugins: [],
}