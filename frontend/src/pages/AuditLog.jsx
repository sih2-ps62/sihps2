import { useState } from 'react'
import { api } from '../services/api'
import { useFetch } from '../hooks/useFetch'
import { LoadingState, ErrorState, EmptyState } from '../components/States'
import StatusBadge from '../components/StatusBadge'

const MODULES = ['expeditions', 'cargo', 'inventory', 'personnel', 'emergency', 'assets', 'system']

export default function AuditLog() {
  const [moduleFilter, setModuleFilter] = useState('')
  const { data, loading, error, reload } = useFetch(
    () => api.getAuditLog(moduleFilter ? { module: moduleFilter } : {}),
    [moduleFilter]
  )

  if (loading) return <LoadingState label="Loading audit log…" />
  if (error) return <ErrorState message={error} onRetry={reload} />

  const entries = data || []

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-white">Audit Log</h1>
        <p className="text-sm text-slate-500">Immutable, append-only record of every write — actor, module, target, timestamp.</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setModuleFilter('')} className={`text-xs px-3 py-1.5 rounded-lg border capitalize ${!moduleFilter ? 'bg-accent-500/20 border-accent-500/50 text-accent-300' : 'border-base-700 text-slate-500'}`}>All modules</button>
        {MODULES.map((m) => (
          <button key={m} onClick={() => setModuleFilter(m)} className={`text-xs px-3 py-1.5 rounded-lg border capitalize ${moduleFilter === m ? 'bg-accent-500/20 border-accent-500/50 text-accent-300' : 'border-base-700 text-slate-500'}`}>{m}</button>
        ))}
      </div>

      {entries.length === 0 ? (
        <EmptyState label="No audit entries yet." hint="Every create/update across the app writes one here automatically." />
      ) : (
        <div className="bg-base-900 border border-base-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-base-800 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2.5">Timestamp</th>
                <th className="text-left px-4 py-2.5">Status</th>
                <th className="text-left px-4 py-2.5">Module</th>
                <th className="text-left px-4 py-2.5">Action</th>
                <th className="text-left px-4 py-2.5">Target</th>
                <th className="text-left px-4 py-2.5">Actor</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-base-800">
                  <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{new Date(e.timestamp).toLocaleString()}</td>
                  <td className="px-4 py-2.5"><StatusBadge value={e.status} /></td>
                  <td className="px-4 py-2.5 text-slate-400 capitalize">{e.module}</td>
                  <td className="px-4 py-2.5 text-slate-200">{e.action_description}</td>
                  <td className="px-4 py-2.5 text-slate-500">{e.target_id || '—'}</td>
                  <td className="px-4 py-2.5 text-slate-500">{e.actor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
