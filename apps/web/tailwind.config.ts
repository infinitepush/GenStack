import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#121212", // Neutral Dark
        panel: "#181818",      // Softer Cards/Panels
        elevated: "#1F1F1F",   // Input/Secondary Surface
        line: "rgba(255, 255, 255, 0.06)", // Subtle, thin borders
        indigo: {
          electric: "#5E6AD2"  // Map electric purple/teal to Slate Blue
        },
        accent: {
          DEFAULT: "#5E6AD2",  // Slate Blue
          hover: "#4C58C1",
          light: "#828DF0"
        },
        success: {
          DEFAULT: "#10b981",  // Green
          hover: "#059669"
        },
        warning: {
          DEFAULT: "#f59e0b",  // Amber
          hover: "#d97706"
        },
        danger: {
          DEFAULT: "#ef4444",  // Red
          hover: "#dc2626"
        }
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
