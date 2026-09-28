import { useTheme } from "../context/ThemeContext";

// Recharts renders inline SVG and needs literal colour values, not Tailwind classes, so it can't pick up the
// CSS-variable theme (index.css) automatically the way the rest of the app does. This is the one place those
// values are duplicated — kept in sync with the "Frost" (:root) and "Aurora" (.dark) tokens there.
const PALETTES = {
  light: {
    grid: "#CFE3EE",
    tick: "#5C7C90",
    tooltipBg: "#FFFFFF",
    tooltipBorder: "#CFE3EE",
    tooltipLabel: "#14324A",
    accent: "#2AA9E0",
    ok: "#15A874",
    warning: "#D97706",
    critical: "#DC2626",
    muted: "#CFE3EE",
    secondary: "#5C7C90",
  },
  dark: {
    grid: "#1E3A4C",
    tick: "#86A9BC",
    tooltipBg: "#0B1420",
    tooltipBorder: "#1E3A4C",
    tooltipLabel: "#EAF6FA",
    accent: "#3DDC97",
    ok: "#34D399",
    warning: "#FBBF24",
    critical: "#F87171",
    muted: "#22384A",
    secondary: "#86A9BC",
  },
};

export function useChartColors() {
  const { theme } = useTheme();
  return PALETTES[theme] ?? PALETTES.light;
}
