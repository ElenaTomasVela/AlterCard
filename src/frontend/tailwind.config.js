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
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          dark: "#f47c00",
          darker: "#ca5a00",
          darkest: "#b64c00",
        },
        primary: {
          DEFAULT: "rgb(var(--primary) / <alpha-value>)",
          dark: "#009bc5",
          darker: "#0071ab",
          darkest: "#004778",
        },
        card: {
          red: "rgb(var(--card-red) / <alpha-value>)",
          blue: "rgb(var(--card-blue) / <alpha-value>)",
          green: "rgb(var(--card-green) / <alpha-value>)",
          yellow: "rgb(var(--card-yellow) / <alpha-value>)",
        },
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
      backgroundImage: {
        wildcard:
          "linear-gradient(135deg, #ff7340 0% 25%, #ffd45c 25% 50%, #3fd66c 50%  75%, #00bcd4 75%)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
