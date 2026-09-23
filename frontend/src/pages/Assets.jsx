import { useState } from 'react'
import { api } from '../services/api'
import { useFetch } from '../hooks/useFetch'
import { LoadingState, ErrorState, EmptyState } from '../components/States'
import StatusBadge from '../components/StatusBadge'

async function loadAll() {
  const [assets, stations, alerts] = await Promise.all([api.listAssets(), api.listStations(), api.getAlerts()])
  return { assets, stations, alerts }
}

function healthColor(pct) {
  if (pct >= 70) return 'bg-emerald-500'
  if (pct >= 40) return 'bg-amber-500'
  return 'bg-red-500'
}

function CreateForm({ stations, onCreated, onCancel }) {
  const [form, setForm] = useState({ name: '', type: '', station_id: '', health_pct: 100, next_maintenance_date: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await api.createAsset({
        name: form.name,
        type: form.type || null,
        station_id: form.station_id || null,
        health_pct: Number(form.health_pct),
        next_maintenance_date: form.next_maintenance_date || null,
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
      <h3 className="text-sm font-medium text-slate-200">Register Asset</h3>
      {error && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input required placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="bg-base-800 border border-base-700 rounded-lg px-3 py-2 text-sm text-slate-200 md:col-span-2" />
        <input placeholder="Type (generator, vehicle...)" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
          className="bg-base-800 border border-base-700 rounded-lg px-3 py-2 text-sm text-slate-200" />
        <select value={form.station_id} onChange={(e) => setForm({ ...form, station_id: e.target.value })}
          className="bg-base-800 border border-base-700 rounded-lg px-3 py-2 text-sm text-slate-200">
          <option value="">Station</option>
          {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input type="number" min="0" max="100" placeholder="Health %" value={form.health_pct}
          onChange={(e) => setForm({ ...form, health_pct: e.target.value })}
          className="bg-base-800 border border-base-700 rounded-lg px-3 py-2 text-sm text-slate-200" />
        <input type="date" value={form.next_maintenance_date} onChange={(e) => setForm({ ...form, next_maintenance_date: e.target.value })}
          className="bg-base-800 border border-base-700 rounded-lg px-3 py-2 text-sm text-slate-200" />
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <button type="button" onClick={onCancel} className="px-4 py-1.5 rounded-lg text-sm text-slate-400 hover:text-slate-200">Cancel</button>
        <button type="submit" disabled={saving} className="px-4 py-1.5 rounded-lg bg-accent-500 hover:bg-accent-400 disabled:opacity-50 text-white text-sm font-medium">
          {saving ? 'Saving…' : 'Register Asset'}
        </button>
      </div>
    </form>
  )
}

export default function Assets() {
  const { data, loading, error, reload } = useFetch(loadAll, [])
  const [showCreate, setShowCreate] = useState(false)
  const [busyId, setBusyId] = useState(null)

  const ping = async (id, delta) => {
    setBusyId(id)
    try {
      const asset = data.assets.find((a) => a.id === id)
      const newHealth = Math.max(0, Math.min(100, asset.health_pct + delta))
      await api.pushTelemetry(id, { health_pct: newHealth })
      reload()
    } catch (err) {
      alert(err.message)
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <LoadingState label="Loading assets…" />
  if (error) return <ErrorState message={error} onRetry={reload} />
  if (!data) return null

  const { assets, stations, alerts } = data
  const correlated = alerts.filter((a) => a.type === 'correlated_risk')
  const stationName = (id) => stations.find((s) => s.id === id)?.name || id

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Asset Management</h1>
          <p className="text-sm text-slate-500">
            Equipment health &amp; maintenance. Telemetry values are simulated for this demo.
          </p>
        </div>
        <button onClick={() => setShowCreate((s) => !s)} className="px-4 py-2 rounded-lg bg-accent-500 hover:bg-accent-400 text-white text-sm font-medium">
          {showCreate ? 'Close form' : '+ Register Asset'}
        </button>
      </div>

      {showCreate && <CreateForm stations={stations} onCreated={() => { setShowCreate(false); reload() }} onCancel={() => setShowCreate(false)} />}

      {correlated.length > 0 && (
        <div className="space-y-2">
          {correlated.map((a) => (
            <div key={a.id} className="bg-accent-500/10 border border-accent-500/40 rounded-xl px-4 py-3 flex items-start gap-3">
              <span className="text-accent-400 text-lg leading-none">⚡</span>
              <div>
                <p className="text-xs font-medium text-accent-300 uppercase tracking-wide mb-0.5">Cross-system correlated risk</p>
                <p className="text-sm text-slate-200">{a.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {assets.length === 0 ? (
        <EmptyState label="No assets registered." />
      ) : (
        <div className="bg-base-900 border border-base-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-base-800 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2.5">Asset</th>
                <th className="text-left px-4 py-2.5">Station</th>
                <th className="text-left px-4 py-2.5">Health</th>
                <th className="text-left px-4 py-2.5">Status</th>
                <th className="text-left px-4 py-2.5">Runtime</th>
                <th className="text-left px-4 py-2.5">Next Maint.</th>
                <th className="text-left px-4 py-2.5">Telemetry</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => (
                <tr key={a.id} className="border-t border-base-800">
                  <td className="px-4 py-2.5 text-slate-200">{a.name}<div className="text-xs text-slate-600">{a.type}</div></td>
                  <td className="px-4 py-2.5 text-slate-400">{stationName(a.station_id)}</td>
                  <td className="px-4 py-2.5 w-40">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-base-700 rounded-full overflow-hidden">
                        <div className={`h-full ${healthColor(a.health_pct)}`} style={{ width: `${a.health_pct}%` }} />
                      </div>
                      <span className="text-xs text-slate-400 w-9">{a.health_pct.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5"><StatusBadge value={a.status} /></td>
                  <td className="px-4 py-2.5 text-slate-400">{a.runtime_hours}h</td>
                  <td className="px-4 py-2.5 text-slate-500">{a.next_maintenance_date || '—'}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1.5">
                      <button disabled={busyId === a.id} onClick={() => ping(a.id, -10)}
                        className="text-xs px-2 py-1 rounded-md bg-base-800 hover:bg-red-500/20 text-slate-400 hover:text-red-300">−10%</button>
                      <button disabled={busyId === a.id} onClick={() => ping(a.id, 10)}
                        className="text-xs px-2 py-1 rounded-md bg-base-800 hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-300">+10%</button>
                    </div>
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
