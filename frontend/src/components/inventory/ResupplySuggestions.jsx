import { Truck, ArrowRight } from "lucide-react";
import Reveal from "../ui/Reveal";
import { useQuery } from "../../hooks/useApi";
import { api } from "../../lib/api";
import { weatherMeta } from "../../lib/weather";

// Cross-references low stock against real surplus elsewhere, ranked by real station distance
// (backend/resupply.py) — the recommendation a duty officer would otherwise have to work out by hand.
export default function ResupplySuggestions({ delay = 0 }) {
  const { data, isLoading } = useQuery(() => api.get("/resupply-suggestions"), []);
  const suggestions = data?.data ?? [];

  if (!isLoading && suggestions.length === 0) return null;

  return (
    <Reveal delay={delay} className="glass-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <Truck size={18} strokeWidth={1.75} className="text-accent" />
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Suggested Transfers</h2>
          <p className="text-sm text-text-secondary">Nearest real surplus for each low-stock item</p>
        </div>
      </div>
      {isLoading ? (
        <p className="text-sm text-text-secondary">Loading…</p>
      ) : (
        <div className="space-y-2">
          {suggestions.map((s, idx) => {
            const weather = weatherMeta(s.from_weather_code);
            const WeatherIcon = weather.icon;
            return (
              <div
                key={idx}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 p-3 text-sm"
              >
                <span className="font-medium text-text-primary">
                  {s.quantity} {s.unit} {s.item}
                </span>
                <span className="flex items-center gap-1.5 text-text-secondary">
                  {s.from_station_name}
                  <span className="flex items-center gap-1" title={`${weather.label} at ${s.from_station_name}`}>
                    <WeatherIcon size={13} strokeWidth={1.75} />
                  </span>
                  <ArrowRight size={14} strokeWidth={1.75} />
                  {s.to_station_name}
                </span>
                <span className="ml-auto shrink-0 text-xs text-text-secondary">{s.distance_km} km</span>
              </div>
            );
          })}
        </div>
      )}
    </Reveal>
  );
}
