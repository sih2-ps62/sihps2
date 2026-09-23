import { MapContainer, TileLayer, CircleMarker, Popup, Polyline } from 'react-leaflet'

const STATION_COLOR = { operational: '#34d399', degraded: '#f59e0b', offline: '#ef4444' }
const PERSON_COLOR = {
  at_base: '#94a3b8',
  in_transit: '#60a5fa',
  on_expedition: '#2dd4bf',
  overdue: '#f59e0b',
  emergency: '#ef4444',
}
const ROUTE_COLOR = { planned: '#64748b', in_progress: '#4f46e5', completed: '#10b981' }

export default function PolarMap({ stations = [], personnel = [], expeditions = [], height = 420 }) {
  const center = stations.length
    ? [
        stations.reduce((s, st) => s + st.lat, 0) / stations.length,
        stations.reduce((s, st) => s + st.lng, 0) / stations.length,
      ]
    : [-75, 40]

  const stationById = Object.fromEntries(stations.map((s) => [s.id, s]))

  return (
    <div style={{ height }} className="rounded-xl overflow-hidden border border-base-700">
      <MapContainer center={center} zoom={3} style={{ height: '100%', width: '100%' }} scrollWheelZoom={true}>
        <TileLayer
          attribution="&copy; OpenStreetMap contributors, &copy; CARTO"
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {expeditions.map((exp) => {
          const points = (exp.waypoints || [])
            .slice()
            .sort((a, b) => a.sequence - b.sequence)
            .map((w) => stationById[w.station_id])
            .filter(Boolean)
            .map((s) => [s.lat, s.lng])
          if (points.length < 2) return null
          return (
            <Polyline
              key={exp.id}
              positions={points}
              pathOptions={{ color: ROUTE_COLOR[exp.status] || '#64748b', weight: 3, opacity: 0.8, dashArray: exp.status === 'planned' ? '6 6' : undefined }}
            />
          )
        })}

        {stations.map((s) => (
          <CircleMarker
            key={s.id}
            center={[s.lat, s.lng]}
            radius={8}
            pathOptions={{
              color: STATION_COLOR[s.status] || '#4f46e5',
              fillColor: STATION_COLOR[s.status] || '#4f46e5',
              fillOpacity: 0.9,
              weight: 2,
            }}
          >
            <Popup>
              <strong>{s.name}</strong>
              <br />
              {s.type} · {s.status}
            </Popup>
          </CircleMarker>
        ))}

        {personnel.map((p) =>
          p.lat != null && p.lng != null ? (
            <CircleMarker
              key={p.id}
              center={[p.lat, p.lng]}
              radius={4}
              pathOptions={{
                color: PERSON_COLOR[p.status] || '#94a3b8',
                fillColor: PERSON_COLOR[p.status] || '#94a3b8',
                fillOpacity: 0.9,
                weight: 1,
              }}
            >
              <Popup>
                <strong>{p.name}</strong>
                <br />
                {p.role} · {p.status}
              </Popup>
            </CircleMarker>
          ) : null
        )}
      </MapContainer>
    </div>
  )
}
