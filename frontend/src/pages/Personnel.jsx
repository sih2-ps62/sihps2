import { useState } from 'react'
import { api } from '../services/api'
import { useFetch } from '../hooks/useFetch'
import { LoadingState, ErrorState, EmptyState } from '../components/States'
import StatusBadge from '../components/StatusBadge'

async function loadAll() {
  const [personnel, stations] = await Promise.all([api.listPersonnel(), api.listStations()])
  return { personnel, stations }
}

function timeAgo(iso) {
  if (!iso) return '—'
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  return `${hrs}h ago`
}

export default function Personnel() {
  const { data, loading, error, reload } = useFetch(loadAll, [])
  const [busyId, setBusyId] = useState(null)

  const checkin = async (id) => {
    setBusyId(id)
    try {
      await api.checkin(id)
      reload()
    } catch (err) {
      alert(err.message)
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <LoadingState label="Loading personnel…" />
  if (error) return <ErrorState message={error} onRetry={reload} />
  if (!data) return null

  const { personnel, stations } = data
  const stationName = (id) => stations.find((s) => s.id === id)?.name || id

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-white">Personnel Tracker</h1>
        <p className="text-sm text-slate-500">Roster, movement, and geofence-aware safety status.</p>
      </div>

      {personnel.length === 0 ? (
        <EmptyState label="No personnel records." />
      ) : (
        <div className="bg-base-900 border border-base-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-base-800 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2.5">Name</th>
                <th className="text-left px-4 py-2.5">Role</th>
                <th className="text-left px-4 py-2.5">Station</th>
                <th className="text-left px-4 py-2.5">Distance</th>
                <th className="text-left px-4 py-2.5">Last Check-in</th>
                <th className="text-left px-4 py-2.5">Status</th>
                <th className="text-left px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {personnel.map((p) => (
                <tr key={p.id} className={`border-t border-base-800 ${['overdue', 'emergency'].includes(p.status) ? 'bg-red-500/5' : ''}`}>
                  <td className="px-4 py-2.5 text-slate-200">{p.name}</td>
                  <td className="px-4 py-2.5 text-slate-400">{p.role}</td>
                  <td className="px-4 py-2.5 text-slate-400">{stationName(p.current_station_id)}</td>
                  <td className="px-4 py-2.5 text-slate-400">
                    {p.distance_from_station_km != null ? `${p.distance_from_station_km} km` : '—'}
                    {p.distance_from_station_km > 15 && <span className="text-red-400 ml-1">⚠</span>}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{timeAgo(p.last_checkin)}</td>
                  <td className="px-4 py-2.5"><StatusBadge value={p.status} /></td>
                  <td className="px-4 py-2.5">
                    <button
                      disabled={busyId === p.id}
                      onClick={() => checkin(p.id)}
                      className="text-xs px-2.5 py-1 rounded-md bg-base-800 hover:bg-accent-500/30 text-slate-300 hover:text-accent-300 disabled:opacity-50 transition-colors"
                    >
                      {busyId === p.id ? '…' : 'Check in'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
