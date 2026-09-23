import { useState } from 'react'
import { api } from '../services/api'
import { useFetch } from '../hooks/useFetch'
import { LoadingState, ErrorState, EmptyState } from '../components/States'
import StatusBadge from '../components/StatusBadge'

async function loadAll() {
  const [cargo, expeditions, stations] = await Promise.all([
    api.listCargo(),
    api.listExpeditions(),
    api.listStations(),
  ])
  return { cargo, expeditions, stations }
}

const COLUMNS = ['stored', 'in_transit', 'delivered']

function CreateForm({ stations, expeditions, onCreated, onCancel }) {
  const [form, setForm] = useState({
    name: '', category: '', weight_kg: '', current_station_id: '', expedition_id: '', is_critical_part: false,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await api.createCargo({
        name: form.name,
        category: form.category || null,
        weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
        current_station_id: form.current_station_id || null,
        expedition_id: form.expedition_id || null,
        is_critical_part: form.is_critical_part,
        status: 'stored',
      })
      onCreated()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="bg-base-900 border border-base-700 rounded-xl p-5 space-y-3">
      <h3 className="text-sm font-medium text-slate-200">Register Cargo</h3>
      {error && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input required placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="bg-base-800 border border-base-700 rounded-lg px-3 py-2 text-sm text-slate-200 md:col-span-2" />
        <input placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
          className="bg-base-800 border border-base-700 rounded-lg px-3 py-2 text-sm text-slate-200" />
        <input type="number" placeholder="Weight (kg)" value={form.weight_kg} onChange={(e) => setForm({ ...form, weight_kg: e.target.value })}
          className="bg-base-800 border border-base-700 rounded-lg px-3 py-2 text-sm text-slate-200" />
        <select value={form.current_station_id} onChange={(e) => setForm({ ...form, current_station_id: e.target.value })}
          className="bg-base-800 border border-base-700 rounded-lg px-3 py-2 text-sm text-slate-200">
          <option value="">Current station</option>
          {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={form.expedition_id} onChange={(e) => setForm({ ...form, expedition_id: e.target.value })}
          className="bg-base-800 border border-base-700 rounded-lg px-3 py-2 text-sm text-slate-200">
          <option value="">Expedition (optional)</option>
          {expeditions.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-300 md:col-span-2">
          <input type="checkbox" checked={form.is_critical_part} onChange={(e) => setForm({ ...form, is_critical_part: e.target.checked })} />
          Critical replacement part
        </label>
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <button type="button" onClick={onCancel} className="px-4 py-1.5 rounded-lg text-sm text-slate-400 hover:text-slate-200">Cancel</button>
        <button type="submit" disabled={saving} className="px-4 py-1.5 rounded-lg bg-accent-500 hover:bg-accent-400 disabled:opacity-50 text-white text-sm font-medium">
          {saving ? 'Saving…' : 'Register'}
        </button>
      </div>
    </form>
  )
}

function CargoCard({ item, onAdvance, stations }) {
  const stationName = stations.find((s) => s.id === item.current_station_id)?.name
  const nextStatus = { stored: 'in_transit', in_transit: 'delivered' }[item.status]

  return (
    <div className={`bg-base-800 border rounded-lg p-3 ${item.is_delayed ? 'border-red-500/50' : 'border-base-700'}`}>
      <div className="flex items-start justify-between mb-1.5">
        <span className="text-sm text-slate-200 font-medium">{item.name}</span>
        {item.is_critical_part && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">critical</span>
        )}
      </div>
      <div className="text-xs text-slate-500 space-y-0.5 mb-2">
        {item.category && <div>{item.category}{item.weight_kg ? ` · ${item.weight_kg}kg` : ''}</div>}
        {stationName && <div>@ {stationName}</div>}
        {item.expedition_id && <div>Exp: {item.expedition_id}</div>}
        {item.is_delayed && <div className="text-red-400">Delayed {item.delayed_hours}h</div>}
      </div>
      {nextStatus && (
        <button
          onClick={() => onAdvance(item.id, nextStatus)}
          className="text-xs px-2 py-1 rounded-md bg-base-700 hover:bg-accent-500/30 text-slate-300 hover:text-accent-300 transition-colors"
        >
          Mark {nextStatus.replace('_', ' ')} →
        </button>
      )}
    </div>
  )
}

export default function Cargo() {
  const { data, loading, error, reload } = useFetch(loadAll, [])
  const [showCreate, setShowCreate] = useState(false)
  const [filterExp, setFilterExp] = useState('')

  const advance = async (id, status) => {
    try {
      await api.updateCargo(id, { status })
      reload()
    } catch (err) {
      alert(err.message)
    }
  }

  if (loading) return <LoadingState label="Loading cargo…" />
  if (error) return <ErrorState message={error} onRetry={reload} />
  if (!data) return null

  const { cargo, expeditions, stations } = data
  const filtered = filterExp ? cargo.filter((c) => c.expedition_id === filterExp) : cargo

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Cargo Tracker</h1>
          <p className="text-sm text-slate-500">stored → in-transit → delivered, tied to an expedition.</p>
        </div>
        <button onClick={() => setShowCreate((s) => !s)} className="px-4 py-2 rounded-lg bg-accent-500 hover:bg-accent-400 text-white text-sm font-medium">
          {showCreate ? 'Close form' : '+ Register Cargo'}
        </button>
      </div>

      {showCreate && (
        <CreateForm stations={stations} expeditions={expeditions} onCreated={() => { setShowCreate(false); reload() }} onCancel={() => setShowCreate(false)} />
      )}

      <select value={filterExp} onChange={(e) => setFilterExp(e.target.value)}
        className="bg-base-800 border border-base-700 rounded-lg px-3 py-1.5 text-sm text-slate-300">
        <option value="">All expeditions</option>
        {expeditions.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
      </select>

      {filtered.length === 0 ? (
        <EmptyState label="No cargo records." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {COLUMNS.map((col) => (
            <div key={col} className="bg-base-900 border border-base-700 rounded-xl p-3">
              <div className="flex items-center justify-between mb-3 px-1">
                <StatusBadge value={col} />
                <span className="text-xs text-slate-500">{filtered.filter((c) => c.status === col).length}</span>
              </div>
              <div className="space-y-2">
                {filtered.filter((c) => c.status === col).map((item) => (
                  <CargoCard key={item.id} item={item} onAdvance={advance} stations={stations} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
