import { useState } from 'react'
import { api } from '../services/api'
import { useFetch } from '../hooks/useFetch'
import { LoadingState, ErrorState, EmptyState } from '../components/States'
import StatusBadge from '../components/StatusBadge'

async function loadAll() {
  const [inventory, stations] = await Promise.all([api.listInventory(), api.listStations()])
  return { inventory, stations }
}

function CreateForm({ stations, onCreated, onCancel }) {
  const [form, setForm] = useState({ name: '', category: '', station_id: '', quantity: '', unit: 'units', reorder_threshold: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await api.createInventoryItem({
        name: form.name,
        category: form.category || null,
        station_id: form.station_id,
        quantity: Number(form.quantity),
        unit: form.unit,
        reorder_threshold: Number(form.reorder_threshold),
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
      <h3 className="text-sm font-medium text-slate-200">Add Inventory Item</h3>
      {error && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <input required placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="bg-base-800 border border-base-700 rounded-lg px-3 py-2 text-sm text-slate-200 md:col-span-3" />
        <select required value={form.station_id} onChange={(e) => setForm({ ...form, station_id: e.target.value })}
          className="bg-base-800 border border-base-700 rounded-lg px-3 py-2 text-sm text-slate-200">
          <option value="">Station</option>
          {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
          className="bg-base-800 border border-base-700 rounded-lg px-3 py-2 text-sm text-slate-200" />
        <input placeholder="Unit (L, kg, units)" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}
          className="bg-base-800 border border-base-700 rounded-lg px-3 py-2 text-sm text-slate-200" />
        <input required type="number" placeholder="Quantity" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })}
          className="bg-base-800 border border-base-700 rounded-lg px-3 py-2 text-sm text-slate-200" />
        <input required type="number" placeholder="Reorder threshold" value={form.reorder_threshold} onChange={(e) => setForm({ ...form, reorder_threshold: e.target.value })}
          className="bg-base-800 border border-base-700 rounded-lg px-3 py-2 text-sm text-slate-200" />
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <button type="button" onClick={onCancel} className="px-4 py-1.5 rounded-lg text-sm text-slate-400 hover:text-slate-200">Cancel</button>
        <button type="submit" disabled={saving} className="px-4 py-1.5 rounded-lg bg-accent-500 hover:bg-accent-400 disabled:opacity-50 text-white text-sm font-medium">
          {saving ? 'Saving…' : 'Add Item'}
        </button>
      </div>
    </form>
  )
}

export default function Inventory() {
  const { data, loading, error, reload } = useFetch(loadAll, [])
  const [showCreate, setShowCreate] = useState(false)
  const [category, setCategory] = useState('')
  const [busyId, setBusyId] = useState(null)

  const adjust = async (id, delta) => {
    setBusyId(id)
    try {
      await api.adjustInventory(id, { delta })
      reload()
    } catch (err) {
      alert(err.message)
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <LoadingState label="Loading inventory…" />
  if (error) return <ErrorState message={error} onRetry={reload} />
  if (!data) return null

  const { inventory, stations } = data
  const categories = [...new Set(inventory.map((i) => i.category).filter(Boolean))]
  const filtered = category ? inventory.filter((i) => i.category === category) : inventory
  const stationName = (id) => stations.find((s) => s.id === id)?.name || id

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Inventory Manager</h1>
          <p className="text-sm text-slate-500">Per-station stock with automatic low-stock alerts.</p>
        </div>
        <button onClick={() => setShowCreate((s) => !s)} className="px-4 py-2 rounded-lg bg-accent-500 hover:bg-accent-400 text-white text-sm font-medium">
          {showCreate ? 'Close form' : '+ Add Item'}
        </button>
      </div>

      {showCreate && <CreateForm stations={stations} onCreated={() => { setShowCreate(false); reload() }} onCancel={() => setShowCreate(false)} />}

      {categories.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setCategory('')} className={`text-xs px-3 py-1.5 rounded-lg border ${!category ? 'bg-accent-500/20 border-accent-500/50 text-accent-300' : 'border-base-700 text-slate-500'}`}>All</button>
          {categories.map((c) => (
            <button key={c} onClick={() => setCategory(c)} className={`text-xs px-3 py-1.5 rounded-lg border capitalize ${category === c ? 'bg-accent-500/20 border-accent-500/50 text-accent-300' : 'border-base-700 text-slate-500'}`}>{c}</button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState label="No inventory records." />
      ) : (
        <div className="bg-base-900 border border-base-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-base-800 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2.5">Item</th>
                <th className="text-left px-4 py-2.5">Station</th>
                <th className="text-left px-4 py-2.5">Quantity</th>
                <th className="text-left px-4 py-2.5">Threshold</th>
                <th className="text-left px-4 py-2.5">Status</th>
                <th className="text-left px-4 py-2.5">Adjust</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className={`border-t border-base-800 ${item.status === 'low' ? 'bg-amber-500/5' : ''}`}>
                  <td className="px-4 py-2.5 text-slate-200">{item.name}</td>
                  <td className="px-4 py-2.5 text-slate-400">{stationName(item.station_id)}</td>
                  <td className="px-4 py-2.5 text-slate-300">{item.quantity} {item.unit}</td>
                  <td className="px-4 py-2.5 text-slate-500">{item.reorder_threshold} {item.unit}</td>
                  <td className="px-4 py-2.5"><StatusBadge value={item.status} /></td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1.5">
                      <button disabled={busyId === item.id} onClick={() => adjust(item.id, -10)} className="text-xs w-7 h-7 rounded-md bg-base-800 hover:bg-base-700 text-slate-300">−</button>
                      <button disabled={busyId === item.id} onClick={() => adjust(item.id, 10)} className="text-xs w-7 h-7 rounded-md bg-base-800 hover:bg-base-700 text-slate-300">+</button>
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
