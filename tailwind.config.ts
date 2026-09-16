import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: "#1B2A4A",
        },
        surface: {
          DEFAULT: "#FAFAF9",
          white: "#FFFFFF",
        },
        ink: {
          DEFAULT: "#171717",
          muted: "#8A8580",
        },
        border: {
          DEFAULT: "#E7E3DD",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        body: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      letterSpacing: {
        wide: "0.12em",
      },
    },
  },
  plugins: [],
} satisfies Config;
