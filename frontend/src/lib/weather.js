// weather_code -> icon + label for the badge shown next to each station. Real live data from the backend's
// weather feed (backend/weather.py, Open-Meteo) — kept as a lookup so every place that renders it matches.
import { Sun, Cloud, CloudSnow, Wind, CloudFog } from "lucide-react";

export const WEATHER_META = {
  clear: { label: "Clear", icon: Sun },
  cloudy: { label: "Cloudy", icon: Cloud },
  snow: { label: "Snow", icon: CloudSnow },
  high_wind: { label: "High wind", icon: Wind },
  blizzard: { label: "Blizzard", icon: CloudFog },
};

export function weatherMeta(code) {
  return WEATHER_META[code] ?? WEATHER_META.clear;
}
