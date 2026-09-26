/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#F7FBFD",
        surface: "rgba(255, 255, 255, 0.72)",
        "surface-solid": "#FFFFFF",
        border: "#CFE3EE",
        "text-primary": "#14324A",
        "text-secondary": "#5C7C90",
        accent: "#2AA9E0",
        "accent-soft": "#E4F5FC",
        status: {
          ok: "#15A874",
          warning: "#D97706",
          critical: "#DC2626",
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
        glass: "0 8px 24px rgba(20, 80, 120, 0.08)",
        "glass-hover": "0 14px 32px rgba(20, 80, 120, 0.14), 0 0 0 1px rgba(42, 169, 224, 0.18)",
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
