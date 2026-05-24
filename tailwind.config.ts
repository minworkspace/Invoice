import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#172126",
        muted: "#5E6A70",
        line: "#D7DEE2",
        paper: "#F7F8F5",
        brand: "#1F6F78",
        accent: "#D86F45"
      },
      boxShadow: {
        soft: "0 14px 30px rgba(23, 33, 38, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
