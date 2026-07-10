import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#0D0F12", // Graphite dark background
        panel: "#15181D",      // Secondary Background
        card: "#1B1F24",       // Premium Card bg
        hover: "#222831",      // Hover color
        elevated: "#222831",   // Elevated inputs / dropdowns
        line: "rgba(255, 255, 255, 0.08)", // Border
        accent: {
          DEFAULT: "#16A34A",  // Primary Accent (Emerald)
          hover: "#22C55E",
          light: "#86EFAC",
          secondary: "#D4AF37" // Secondary Accent (Gold)
        },
        success: {
          DEFAULT: "#16A34A",  // Success (Emerald)
          hover: "#22C55E"
        },
        warning: {
          DEFAULT: "#D97706",  // Warning (Amber)
          hover: "#B45309"
        },
        danger: {
          DEFAULT: "#DC2626",  // Danger (Red)
          hover: "#B91C1C"
        },
        info: {
          DEFAULT: "#64748B",
          hover: "#475569"
        }
      },
      borderRadius: {
        button: "14px",
        card: "20px",
        dialog: "24px",
        input: "14px"
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui"],
        mono: ["var(--font-geist-mono)", "JetBrains Mono", "ui-monospace", "monospace"]
      }
    }
  },
  plugins: []
};

export default config;
