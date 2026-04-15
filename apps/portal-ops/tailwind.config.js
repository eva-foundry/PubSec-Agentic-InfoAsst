/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "gc-blue": "var(--gc-blue)",
        "gc-red": "var(--gc-red)",
        "gc-white": "var(--gc-white)",
        "gc-gray": "var(--gc-gray)",
      },
    },
  },
  plugins: [],
};
