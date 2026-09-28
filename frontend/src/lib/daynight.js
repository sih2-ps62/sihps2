// 'polar_day' (midnight sun) / 'polar_night' — real astronomy (backend/daynight.py), not a live feed. 'normal'
// returns null on purpose: a normal day/night cycle isn't worth a badge, only the two polar-specific states are.
import { Sun, Moon } from "lucide-react";

export const DAY_NIGHT_META = {
  polar_day: { label: "Midnight sun", icon: Sun },
  polar_night: { label: "Polar night", icon: Moon },
};

export function dayNightMeta(code) {
  return DAY_NIGHT_META[code] ?? null;
}
