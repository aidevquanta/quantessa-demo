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
      keyframes: {
        quantessaBounce: {
          "0%, 80%, 100%": { transform: "translateY(0)", opacity: "0.35" },
          "40%": { transform: "translateY(-3px)", opacity: "1" },
        },
        fadeInUp: {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        quantessaBounce: "quantessaBounce 1.2s ease-in-out infinite",
        fadeInUp: "fadeInUp 0.35s ease-out both",
      },
    },
  },
  plugins: [],
} satisfies Config;
