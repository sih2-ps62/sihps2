import { useRef, useState } from "react";
import { MapPin } from "lucide-react";
import PolarMap from "../components/map/PolarMap";
import Reveal from "../components/ui/Reveal";
import { useQuery } from "../hooks/useApi";
import { api } from "../lib/api";
import { weatherMeta } from "../lib/weather";
import { dayNightMeta } from "../lib/daynight";

const READINESS_DOT = { ready: "bg-status-ok", watch: "bg-status-warning", critical: "bg-status-critical" };

export default function MapPage() {
  const [activeStationId, setActiveStationId] = useState(null);
  const markerRefs = useRef({});
  const { data } = useQuery(() => api.get("/stations"), []);
  const stations = data?.data ?? [];

  return (
    <div className="grid grid-cols-1 gap-4 px-6 py-6 md:px-8 lg:grid-cols-[1.85fr_1fr]">
      <PolarMap
        height="600px"
        delay={80}
        activeStationId={activeStationId}
        markerRefs={markerRefs}
        showRoutes
      />
      <Reveal delay={160} className="glass-card flex flex-col gap-4 p-5 lg:max-h-[600px]">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Stations</h2>
          <p className="text-sm text-text-secondary">Active research & supply stations</p>
          <div className="mt-2 flex items-center gap-3 text-xs text-text-secondary">
            {Object.entries(READINESS_DOT).map(([band, dot]) => (
              <span key={band} className="flex items-center gap-1">
                <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden="true" />
                {band}
              </span>
            ))}
          </div>
        </div>
        <div className="thin-scroll flex-1 space-y-2 overflow-y-auto pr-1">
          {stations.map((station) => {
            const weather = weatherMeta(station.weather_code);
            const WeatherIcon = weather.icon;
            const dayNight = dayNightMeta(station.day_night);
            const DayNightIcon = dayNight?.icon;
            return (
              <button
                key={station.id}
                type="button"
                onClick={() => setActiveStationId(station.id)}
                className={`focus-ring flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors duration-200 ${
                  activeStationId === station.id
                    ? "border-accent bg-accent-soft"
                    : "border-border/60 hover:bg-accent-soft/50"
                }`}
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${READINESS_DOT[station.readiness_band] ?? "bg-accent"}`}
                  title={`Readiness ${station.readiness_score ?? "—"}/100`}
                  aria-hidden="true"
                />
                <div className="icon-chip">
                  <MapPin size={16} strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text-primary">{station.name}</p>
                  <p className="text-xs text-text-secondary">{station.region}</p>
                </div>
                <div
                  className="flex shrink-0 items-center gap-1 text-xs text-text-secondary"
                  title={`${weather.label} — live conditions`}
                >
                  <WeatherIcon size={14} strokeWidth={1.75} />
                  {weather.label}
                </div>
                {dayNight && (
                  <div
                    className="flex shrink-0 items-center gap-1 text-xs font-medium text-accent"
                    title={`${dayNight.label} — the sun doesn't rise or set here right now`}
                  >
                    <DayNightIcon size={14} strokeWidth={1.75} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </Reveal>
    </div>
  );
}
