import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { useFetch } from '../hooks/useFetch'
import { LoadingState, ErrorState, EmptyState } from '../components/States'
import StatusBadge from '../components/StatusBadge'

async function loadAll() {
  const [expeditions, stations, personnel, cargo] = await Promise.all([
    api.listExpeditions(),
    api.listStations(),
    api.listPersonnel(),
    api.listCargo(),
  ])
  return { expeditions, stations, personnel, cargo }
}

const STATUS_FLOW = ['planned', 'in_progress', 'completed']

function CreateForm({ stations, personnel, cargo, onCreated, onCancel }) {
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [teamLead, setTeamLead] = useState('')
  const [waypoints, setWaypoints] = useState([{ station_id: '', sequence: 1, eta: '' }])
  const [personnelIds, setPersonnelIds] = useState([])
  const [cargoIds, setCargoIds] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const addWaypoint = () =>
    setWaypoints((w) => [...w, { station_id: '', sequence: w.length + 1, eta: '' }])
  const removeWaypoint = (idx) => setWaypoints((w) => w.filter((_, i) => i !== idx))
  const updateWaypoint = (idx, field, value) =>
    setWaypoints((w) => w.map((wp, i) => (i === idx ? { ...wp, [field]: value } : wp)))

  const togglePerson = (id) =>
    setPersonnelIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
  const toggleCargo = (id) =>
    setCargoIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await api.createExpedition({
        name,
        start_date: startDate,
        end_date: endDate,
        team_lead_id: teamLead || null,
        waypoints: waypoints
          .filter((w) => w.station_id)
          .map((w) => ({
            station_id: w.station_id,
            sequence: Number(w.sequence),
            eta: w.eta ? new Date(w.eta).toISOString() : null,
          })),
        personnel_ids: personnelIds,
        cargo_ids: cargoIds,
      })
      onCreated()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="bg-base-900 border border-base-700 rounded-xl p-5 space-y-4">
      <h3 className="text-sm font-medium text-slate-200">New Expedition</h3>
      {error && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Expedition name"
          className="bg-base-800 border border-base-700 rounded-lg px-3 py-2 text-sm text-slate-200 md:col-span-3" />
        <input required type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
          className="bg-base-800 border border-base-700 rounded-lg px-3 py-2 text-sm text-slate-200" />
        <input required type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
          className="bg-base-800 border border-base-700 rounded-lg px-3 py-2 text-sm text-slate-200" />
        <select value={teamLead} onChange={(e) => setTeamLead(e.target.value)}
          className="bg-base-800 border border-base-700 rounded-lg px-3 py-2 text-sm text-slate-200">
          <option value="">Team lead (optional)</option>
          {personnel.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-slate-500">Waypoints (in sequence)</label>
          <button type="button" onClick={addWaypoint} className="text-xs text-accent-400 hover:text-accent-300">+ Add waypoint</button>
        </div>
        <div className="space-y-2">
          {waypoints.map((wp, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <span className="text-xs text-slate-500 w-4">{idx + 1}</span>
              <select value={wp.station_id} onChange={(e) => updateWaypoint(idx, 'station_id', e.target.value)}
                className="flex-1 bg-base-800 border border-base-700 rounded-lg px-2 py-1.5 text-sm text-slate-200">
                <option value="">Select station</option>
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <input type="datetime-local" value={wp.eta} onChange={(e) => updateWaypoint(idx, 'eta', e.target.value)}
                className="bg-base-800 border border-base-700 rounded-lg px-2 py-1.5 text-sm text-slate-200" />
              {waypoints.length > 1 && (
                <button type="button" onClick={() => removeWaypoint(idx)} className="text-slate-500 hover:text-red-400 text-sm px-1">×</button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-slate-500 block mb-1.5">Assign personnel</label>
          <div className="max-h-32 overflow-y-auto space-y-1 bg-base-800 rounded-lg p-2 border border-base-700">
            {personnel.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input type="checkbox" checked={personnelIds.includes(p.id)} onChange={() => togglePerson(p.id)} />
                {p.name} <span className="text-slate-600 text-xs">({p.role})</span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1.5">Assign cargo</label>
          <div className="max-h-32 overflow-y-auto space-y-1 bg-base-800 rounded-lg p-2 border border-base-700">
            {cargo.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input type="checkbox" checked={cargoIds.includes(c.id)} onChange={() => toggleCargo(c.id)} />
                {c.name}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-1.5 rounded-lg text-sm text-slate-400 hover:text-slate-200">Cancel</button>
        <button type="submit" disabled={saving} className="px-4 py-1.5 rounded-lg bg-accent-500 hover:bg-accent-400 disabled:opacity-50 text-white text-sm font-medium">
          {saving ? 'Creating…' : 'Create Expedition'}
        </button>
      </div>
    </form>
  )
}

function DetailPanel({ id, stations, onClose, onChanged }) {
  const [exp, setExp] = useState(null)
  const [error, setError] = useState(null)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    api.getExpedition(id).then(setExp).catch((e) => setError(e.message))
  }, [id])

  const stationName = (sid) => stations.find((s) => s.id === sid)?.name || sid

  const setStatus = async (status) => {
    setUpdating(true)
    try {
      const updated = await api.updateExpedition(id, { status })
      setExp(updated)
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setUpdating(false)
    }
  }

  if (error) return <ErrorState message={error} />
  if (!exp) return <LoadingState />

  return (
    <div className="bg-base-900 border border-base-700 rounded-xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-base font-medium text-white">{exp.name}</h3>
          <p className="text-xs text-slate-500">{exp.id} · {exp.start_date} → {exp.end_date}</p>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-sm">Close</button>
      </div>

      <div className="flex items-center gap-2 mb-5">
        <span className="text-xs text-slate-500">Status:</span>
        {STATUS_FLOW.map((s) => (
          <button
            key={s}
            disabled={updating}
            onClick={() => setStatus(s)}
            className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
              exp.status === s
                ? 'bg-accent-500/20 border-accent-500/50 text-accent-300'
                : 'border-base-700 text-slate-500 hover:text-slate-300'
            }`}
          >
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      <h4 className="text-xs font-medium text-slate-500 mb-2">Waypoint Timeline</h4>
      {exp.waypoints.length === 0 ? (
        <EmptyState label="No waypoints." />
      ) : (
        <div className="space-y-2 mb-4">
          {exp.waypoints.map((w) => (
            <div key={w.id} className="flex items-center justify-between bg-base-800 rounded-lg px-3 py-2">
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 w-5">#{w.sequence}</span>
                <span className="text-sm text-slate-200">{stationName(w.station_id)}</span>
              </div>
              <div className="flex items-center gap-2">
                {w.eta && <span className="text-xs text-slate-500">ETA {new Date(w.eta).toLocaleString()}</span>}
                <StatusBadge value={w.status} />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <h4 className="text-xs font-medium text-slate-500 mb-1.5">Personnel ({exp.personnel_ids.length})</h4>
          <p className="text-slate-400">{exp.personnel_ids.join(', ') || '—'}</p>
        </div>
        <div>
          <h4 className="text-xs font-medium text-slate-500 mb-1.5">Cargo ({exp.cargo_ids.length})</h4>
          <p className="text-slate-400">{exp.cargo_ids.join(', ') || '—'}</p>
        </div>
      </div>
    </div>
  )
}

export default function Expeditions() {
  const { data, loading, error, reload } = useFetch(loadAll, [])
  const [showCreate, setShowCreate] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')

  if (loading) return <LoadingState label="Loading expeditions…" />
  if (error) return <ErrorState message={error} onRetry={reload} />
  if (!data) return null

  const { expeditions, stations, personnel, cargo } = data
  const filtered = statusFilter === 'all' ? expeditions : expeditions.filter((e) => e.status === statusFilter)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Expedition Planner</h1>
          <p className="text-sm text-slate-500">Create, route, and assign teams &amp; cargo.</p>
        </div>
        <button
          onClick={() => setShowCreate((s) => !s)}
          className="px-4 py-2 rounded-lg bg-accent-500 hover:bg-accent-400 text-white text-sm font-medium"
        >
          {showCreate ? 'Close form' : '+ New Expedition'}
        </button>
      </div>

      {showCreate && (
        <CreateForm
          stations={stations}
          personnel={personnel}
          cargo={cargo}
          onCreated={() => {
            setShowCreate(false)
            reload()
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {selectedId && (
        <DetailPanel id={selectedId} stations={stations} onClose={() => setSelectedId(null)} onChanged={reload} />
      )}

      <div className="flex gap-2">
        {['all', ...STATUS_FLOW].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`text-xs px-3 py-1.5 rounded-lg border capitalize ${
              statusFilter === s ? 'bg-accent-500/20 border-accent-500/50 text-accent-300' : 'border-base-700 text-slate-500'
            }`}
          >
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState label="No expeditions match this filter." />
      ) : (
        <div className="bg-base-900 border border-base-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-base-800 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2.5">Name</th>
                <th className="text-left px-4 py-2.5">Dates</th>
                <th className="text-left px-4 py-2.5">Team Lead</th>
                <th className="text-left px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr
                  key={e.id}
                  onClick={() => setSelectedId(e.id)}
                  className="border-t border-base-800 hover:bg-base-800/60 cursor-pointer"
                >
                  <td className="px-4 py-2.5 text-slate-200">{e.name}</td>
                  <td className="px-4 py-2.5 text-slate-400">{e.start_date} → {e.end_date}</td>
                  <td className="px-4 py-2.5 text-slate-400">{e.team_lead_id || '—'}</td>
                  <td className="px-4 py-2.5"><StatusBadge value={e.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
