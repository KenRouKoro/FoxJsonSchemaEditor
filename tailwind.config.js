/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,vue}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      borderRadius: {
        'none': '0',
        DEFAULT: '0',
      },
    },
  },
  plugins: [],
};
