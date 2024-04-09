/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        "accent-darkest": "#b64c00",
        "accent-darker": "#ca5a00",
        "accent-dark": "#f47c00",
        accent: "#ff9800",
        "accent-light": "#ffb406",
        "accent-lighter": "#ffd305",
        "primary-darkest": "#004778",
        "primary-darker": "#0071ab",
        "primary-dark": "#009bc5",
        primary: "#00bcd4",
        "primary-light": "#00d0ea",
        "primary-lighter": "#00e8f7",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

