/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
    "../../packages/eva-ui-kit/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "gc-blue": "var(--gc-blue)",
        "gc-red": "var(--gc-red)",
        "gc-white": "var(--gc-white)",
        "gc-gray": "var(--gc-gray)",
      },
      animation: {
        shimmer: "shimmer 1.5s ease-in-out infinite",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
      },
    },
  },
  plugins: [],
};
