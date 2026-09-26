import { useRef, useState } from "react";
import { MapPin } from "lucide-react";
import PolarMap from "../components/map/PolarMap";
import Reveal from "../components/ui/Reveal";
import { useQuery } from "../hooks/useApi";
import { api } from "../lib/api";

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
        </div>
        <div className="thin-scroll flex-1 space-y-2 overflow-y-auto pr-1">
          {stations.map((station) => (
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
              <div className="icon-chip">
                <MapPin size={16} strokeWidth={1.75} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text-primary">{station.name}</p>
                <p className="text-xs text-text-secondary">{station.region}</p>
              </div>
            </button>
          ))}
        </div>
      </Reveal>
    </div>
  );
}
