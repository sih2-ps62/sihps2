import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Maximize2 } from "lucide-react";
import Reveal from "../ui/Reveal";
import { useQuery } from "../../hooks/useApi";
import { api } from "../../lib/api";

const stationIcon = L.divIcon({
  className: "",
  html: '<span class="block h-3.5 w-3.5 rounded-full bg-accent ring-2 ring-white" style="box-shadow: 0 0 0 3px rgba(42,169,224,0.3)"></span>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  popupAnchor: [0, -7],
});

// Leaflet path styling is inline SVG, not CSS classes — these mirror the
// accent / status.ok / text-secondary tokens in tailwind.config.js.
const ROUTE_STYLE = {
  Active: { color: "#2AA9E0", weight: 3, opacity: 0.85 },
  Planned: { color: "#5C7C90", weight: 2, opacity: 0.7, dashArray: "6 6" },
  Completed: { color: "#15A874", weight: 2, opacity: 0.45 },
};

export default function PolarMap({
  height = "420px",
  delay = 0,
  className = "",
  activeStationId,
  markerRefs,
  showRoutes = false,
}) {
  const [map, setMap] = useState(null);
  const { data: stationsResult } = useQuery(() => api.get("/stations"), []);
  const { data: expeditionsResult } = useQuery(
    () => (showRoutes ? api.get("/expeditions", { pageSize: 100 }) : Promise.resolve(null)),
    [showRoutes]
  );

  const stations = stationsResult?.data ?? [];
  const stationBounds = useMemo(() => stations.map((s) => [s.lat, s.lng]), [stations]);
  const stationsById = useMemo(() => Object.fromEntries(stations.map((s) => [s.id, s])), [stations]);

  const routes = useMemo(() => {
    if (!showRoutes || !expeditionsResult) return [];
    return (expeditionsResult.data ?? [])
      .map((exp) => ({
        id: exp.id,
        name: exp.name,
        status: exp.status,
        positions: (exp.waypoints ?? [])
          .map((stationId) => stationsById[stationId])
          .filter(Boolean)
          .map((s) => [s.lat, s.lng]),
      }))
      .filter((route) => route.positions.length >= 2);
  }, [showRoutes, expeditionsResult, stationsById]);

  useEffect(() => {
    if (!map) return undefined;
    const scale = L.control.scale({ position: "bottomleft", imperial: false, maxWidth: 120 });
    scale.addTo(map);
    return () => scale.remove();
  }, [map]);

  useEffect(() => {
    if (!map || !activeStationId) return undefined;
    const station = stationsById[activeStationId];
    if (!station) return undefined;
    map.flyTo([station.lat, station.lng], 5, { duration: 1.1 });
    const marker = markerRefs?.current?.[station.id];
    if (marker) {
      const timeout = setTimeout(() => marker.openPopup(), 900);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [activeStationId, map, markerRefs, stationsById]);

  if (stations.length === 0) {
    return (
      <Reveal
        delay={delay}
        className={`glass-card flex items-center justify-center text-sm text-text-secondary ${className}`}
        style={{ height }}
      >
        Loading map…
      </Reveal>
    );
  }

  return (
    <Reveal delay={delay} className={`glass-card relative overflow-hidden ${className}`} style={{ height }}>
      <button
        type="button"
        onClick={() => map?.flyToBounds(stationBounds, { padding: [32, 32], duration: 0.8 })}
        className="focus-ring absolute right-3 top-3 z-[1000] flex items-center gap-1.5 rounded-lg border border-border bg-surface-solid px-2.5 py-1.5 text-xs font-medium text-text-primary shadow-glass transition-colors duration-200 hover:bg-accent-soft"
      >
        <Maximize2 size={14} strokeWidth={1.75} />
        Reset view
      </button>
      <MapContainer
        ref={setMap}
        bounds={stationBounds}
        boundsOptions={{ padding: [32, 32] }}
        minZoom={1}
        worldCopyJump
        scrollWheelZoom
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="polar-tiles"
        />
        {routes.map((route) => (
          <Polyline key={route.id} positions={route.positions} pathOptions={ROUTE_STYLE[route.status]}>
            <Tooltip sticky>
              {route.name} · {route.status}
            </Tooltip>
          </Polyline>
        ))}
        {stations.map((station) => (
          <Marker
            key={station.id}
            position={[station.lat, station.lng]}
            icon={stationIcon}
            ref={(el) => {
              if (!markerRefs) return;
              if (el) markerRefs.current[station.id] = el;
              else delete markerRefs.current[station.id];
            }}
          >
            <Popup>
              <p className="text-sm font-semibold text-text-primary">{station.name}</p>
              <p className="text-xs text-text-secondary">{station.region}</p>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </Reveal>
  );
}
