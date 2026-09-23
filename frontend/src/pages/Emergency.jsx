import { useState } from 'react'
import { api } from '../services/api'
import { useFetch } from '../hooks/useFetch'
import { LoadingState, ErrorState, EmptyState } from '../components/States'
import StatusBadge from '../components/StatusBadge'

async function loadAll() {
  const [incidents, stations, personnel] = await Promise.all([
    api.listEmergency(),
    api.listStations(),
    api.listPersonnel(),
  ])
  return { incidents, stations, personnel }
}

function RaiseForm({ stations, personnel, onCreated, onCancel }) {
  const [form, setForm] = useState({ type: '', station_id: '', personnel_id: '', severity: 'medium', description: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await api.raiseEmergency({
        type: form.type,
        station_id: form.station_id || null,
        personnel_id: form.personnel_id || null,
        severity: form.severity,
        description: form.description || null,
      })
      onCreated()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="bg-red-500/5 border border-red-500/30 rounded-xl p-5 space-y-3">
      <h3 className="text-sm font-medium text-red-300">Raise Emergency</h3>
      {error && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input required placeholder="Type (medical, fire, equipment, weather...)" value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
          className="bg-base-800 border border-base-700 rounded-lg px-3 py-2 text-sm text-slate-200 md:col-span-2" />
        <select value={form.station_id} onChange={(e) => setForm({ ...form, station_id: e.target.value })}
          className="bg-base-800 border border-base-700 rounded-lg px-3 py-2 text-sm text-slate-200">
          <option value="">Station (optional)</option>
          {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={form.personnel_id} onChange={(e) => setForm({ ...form, personnel_id: e.target.value })}
          className="bg-base-800 border border-base-700 rounded-lg px-3 py-2 text-sm text-slate-200">
          <option value="">Personnel involved (optional)</option>
          {personnel.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}
          className="bg-base-800 border border-base-700 rounded-lg px-3 py-2 text-sm text-slate-200 md:col-span-2">
          {['low', 'medium', 'high', 'critical'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="bg-base-800 border border-base-700 rounded-lg px-3 py-2 text-sm text-slate-200 md:col-span-2" rows={2} />
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <button type="button" onClick={onCancel} className="px-4 py-1.5 rounded-lg text-sm text-slate-400 hover:text-slate-200">Cancel</button>
        <button type="submit" disabled={saving} className="px-4 py-1.5 rounded-lg bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white text-sm font-medium">
          {saving ? 'Raising…' : 'Raise Emergency'}
        </button>
      </div>
    </form>
  )
}

function IncidentCard({ inc, stations, onChanged }) {
  const [notes, setNotes] = useState(inc.resolution_notes || '')
  const [busy, setBusy] = useState(false)
  const stationName = stations.find((s) => s.id === inc.station_id)?.name

  const setStatus = async (status) => {
    setBusy(true)
    try {
      await api.updateEmergency(inc.id, { status, resolution_notes: status === 'resolved' ? notes : undefined })
      onChanged()
    } catch (err) {
      alert(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-base-900 border border-base-700 rounded-xl p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-200 capitalize">{inc.type}</span>
          <StatusBadge value={inc.severity} />
          {inc.auto_generated && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-500/20 text-accent-300 border border-accent-500/40">
              system-raised
            </span>
          )}
        </div>
        <StatusBadge value={inc.status} />
      </div>
      <p className="text-xs text-slate-500 mb-1">
        {inc.id} · {stationName || 'no station'} {inc.personnel_id ? `· ${inc.personnel_id}` : ''}
      </p>
      {inc.description && <p className="text-sm text-slate-300 mb-3">{inc.description}</p>}

      {inc.status !== 'resolved' ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            {inc.status === 'open' && (
              <button disabled={busy} onClick={() => setStatus('responding')}
                className="text-xs px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40">
                Mark Responding
              </button>
            )}
            {inc.status === 'responding' && (
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Resolution notes…"
                className="flex-1 bg-base-800 border border-base-700 rounded-lg px-2 py-1 text-xs text-slate-200" rows={1} />
            )}
          </div>
          {inc.status === 'responding' && (
            <button disabled={busy} onClick={() => setStatus('resolved')}
              className="text-xs px-3 py-1.5 rounded-lg text-slate-500 hover:text-emerald-400 border border-base-700 hover:border-emerald-500/40 transition-colors">
              Resolve incident
            </button>
          )}
        </div>
      ) : (
        inc.resolution_notes && <p className="text-xs text-slate-500 italic">Resolved: {inc.resolution_notes}</p>
      )}
    </div>
  )
}

export default function Emergency() {
  const { data, loading, error, reload } = useFetch(loadAll, [])
  const [showForm, setShowForm] = useState(false)

  if (loading) return <LoadingState label="Loading emergency response…" />
  if (error) return <ErrorState message={error} onRetry={reload} />
  if (!data) return null

  const { incidents, stations, personnel } = data
  const active = incidents.filter((i) => i.status !== 'resolved')
  const resolved = incidents.filter((i) => i.status === 'resolved')

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Emergency Response</h1>
          <p className="text-sm text-slate-500">raise → respond → resolve</p>
        </div>
        <button onClick={() => setShowForm((s) => !s)} className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-400 text-white text-sm font-medium">
          {showForm ? 'Close form' : '⚠ Raise Emergency'}
        </button>
      </div>

      {showForm && <RaiseForm stations={stations} personnel={personnel} onCreated={() => { setShowForm(false); reload() }} onCancel={() => setShowForm(false)} />}

      <div>
        <h2 className="text-sm font-medium text-slate-400 mb-3">Active Incidents ({active.length})</h2>
        {active.length === 0 ? (
          <EmptyState label="No active incidents." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {active.map((inc) => <IncidentCard key={inc.id} inc={inc} stations={stations} onChanged={reload} />)}
          </div>
        )}
      </div>

      {resolved.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-slate-400 mb-3">Resolved ({resolved.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 opacity-70">
            {resolved.map((inc) => <IncidentCard key={inc.id} inc={inc} stations={stations} onChanged={reload} />)}
          </div>
        </div>
      )}
    </div>
  )
}
