/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Sourced from CSS custom properties (index.css: :root for "Frost" light, .dark for "Aurora" dark) so
        // every component that already uses these semantic tokens re-themes for free — no per-component changes.
        canvas: "color-mix(in srgb, var(--color-canvas) calc(<alpha-value> * 100%), transparent)",
        surface: "color-mix(in srgb, var(--color-surface) calc(<alpha-value> * 100%), transparent)",
        "surface-solid": "var(--color-surface-solid)",
        border: "color-mix(in srgb, var(--color-border) calc(<alpha-value> * 100%), transparent)",
        "text-primary": "color-mix(in srgb, var(--color-text-primary) calc(<alpha-value> * 100%), transparent)",
        "text-secondary": "color-mix(in srgb, var(--color-text-secondary) calc(<alpha-value> * 100%), transparent)",
        accent: "color-mix(in srgb, var(--color-accent) calc(<alpha-value> * 100%), transparent)",
        "accent-soft": "color-mix(in srgb, var(--color-accent-soft) calc(<alpha-value> * 100%), transparent)",
        status: {
          ok: "color-mix(in srgb, var(--color-status-ok) calc(<alpha-value> * 100%), transparent)",
          warning: "color-mix(in srgb, var(--color-status-warning) calc(<alpha-value> * 100%), transparent)",
          critical: "color-mix(in srgb, var(--color-status-critical) calc(<alpha-value> * 100%), transparent)",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      fontSize: {
        xs: ["12px", { lineHeight: "16px" }],
        sm: ["14px", { lineHeight: "20px" }],
        base: ["16px", { lineHeight: "24px" }],
        lg: ["18px", { lineHeight: "26px" }],
        "2xl": ["24px", { lineHeight: "32px" }],
        "3xl": ["30px", { lineHeight: "38px" }],
      },
      borderRadius: {
        "2xl": "16px",
      },
      boxShadow: {
        glass: "var(--shadow-glass)",
        "glass-hover": "var(--shadow-glass-hover)",
      },
      backdropBlur: {
        glass: "16px",
      },
      maxWidth: {
        content: "1440px",
      },
      transitionDuration: {
        400: "400ms",
      },
      keyframes: {
        "fade-slide-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "snowflake-pop": {
          "0%": { opacity: "0", transform: "scale(0.4) rotate(0deg)" },
          "30%": { opacity: "1", transform: "scale(1.15) rotate(40deg)" },
          "100%": { opacity: "0", transform: "scale(0.85) translateY(-16px) rotate(90deg)" },
        },
        "risk-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 0 var(--pulse-color, transparent)" },
          "35%": { boxShadow: "0 0 0 10px var(--pulse-color, transparent)" },
        },
      },
      animation: {
        "fade-slide-up": "fade-slide-up 400ms ease-out both",
        "snowflake-pop": "snowflake-pop 800ms ease-out forwards",
        "risk-pulse": "risk-pulse 600ms ease-out 1",
      },
    },
  },
  plugins: [],
};
