import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, LayersControl, Marker, Popup, Polyline, Tooltip } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Maximize2 } from "lucide-react";
import Reveal from "../ui/Reveal";
import { useQuery } from "../../hooks/useApi";
import { api } from "../../lib/api";
import { weatherMeta } from "../../lib/weather";
import { dayNightMeta } from "../../lib/daynight";
import { useChartColors } from "../../hooks/useChartColors";

// Leaflet icons/paths are inline SVG/HTML, not CSS classes, so they need literal colour values — reuses the
// same theme-aware palette the analytics charts use (useChartColors), rather than a third hardcoded copy.
const stationIconCache = {};
function stationIcon(color) {
  if (!stationIconCache[color]) {
    stationIconCache[color] = L.divIcon({
      className: "",
      html: `<span class="block h-3.5 w-3.5 rounded-full ring-2 ring-white" style="background:${color}; box-shadow: 0 0 0 3px ${color}4D"></span>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
      popupAnchor: [0, -7],
    });
  }
  return stationIconCache[color];
}

export default function PolarMap({
  height = "420px",
  delay = 0,
  className = "",
  activeStationId,
  markerRefs,
  showRoutes = false,
}) {
  const [map, setMap] = useState(null);
  const colors = useChartColors();
  const readinessColor = { ready: colors.ok, watch: colors.warning, critical: colors.critical };
  const routeStyle = {
    Active: { color: colors.accent, weight: 3, opacity: 0.85 },
    Planned: { color: colors.secondary, weight: 2, opacity: 0.7, dashArray: "6 6" },
    Completed: { color: colors.ok, weight: 2, opacity: 0.45 },
  };

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
        <LayersControl position="bottomright">
          <LayersControl.BaseLayer checked name="Frost">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              className="polar-tiles"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satellite">
            <TileLayer
              attribution='Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS user community'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxNativeZoom={19}
            />
          </LayersControl.BaseLayer>
        </LayersControl>
        {routes.map((route) => (
          <Polyline key={route.id} positions={route.positions} pathOptions={routeStyle[route.status]}>
            <Tooltip sticky>
              {route.name} · {route.status}
            </Tooltip>
          </Polyline>
        ))}
        {stations.map((station) => {
          const weather = weatherMeta(station.weather_code);
          const WeatherIcon = weather.icon;
          const dayNight = dayNightMeta(station.day_night);
          const DayNightIcon = dayNight?.icon;
          return (
            <Marker
              key={station.id}
              position={[station.lat, station.lng]}
              icon={stationIcon(readinessColor[station.readiness_band] ?? colors.accent)}
              ref={(el) => {
                if (!markerRefs) return;
                if (el) markerRefs.current[station.id] = el;
                else delete markerRefs.current[station.id];
              }}
            >
              <Popup>
                <p className="text-sm font-semibold text-text-primary">{station.name}</p>
                <p className="text-xs text-text-secondary">{station.region}</p>
                <p className="mt-1 flex items-center gap-1 text-xs text-text-secondary">
                  <WeatherIcon size={12} strokeWidth={1.75} />
                  {weather.label} · live
                </p>
                {dayNight && (
                  <p className="mt-1 flex items-center gap-1 text-xs font-medium text-accent">
                    <DayNightIcon size={12} strokeWidth={1.75} />
                    {dayNight.label}
                  </p>
                )}
                {station.readiness_score != null && (
                  <p className="mt-1 text-xs font-medium" style={{ color: readinessColor[station.readiness_band] }}>
                    Readiness {station.readiness_score}/100 · {station.readiness_band}
                  </p>
                )}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </Reveal>
  );
}
