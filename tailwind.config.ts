import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "hotspot-low": "#F4B4B4",
        "hotspot-high": "#7A0000",
      },
    },
  },
  plugins: [],
};

export default config;
