import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: "#131921",
          nav: "#232f3e",
          accent: "#febd69",
          orange: "#f08804",
          yellow: "#ffd814",
          yellowHover: "#f7ca00",
          link: "#007185",
          price: "#b12704",
        },
      },
    },
  },
  plugins: [],
};

export default config;
