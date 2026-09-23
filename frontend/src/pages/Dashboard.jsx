import { useState } from 'react'
import { api } from '../services/api'
import { useFetch } from '../hooks/useFetch'
import { LoadingState, ErrorState } from '../components/States'
import StatCard from '../components/StatCard'
import ReadinessBar from '../components/ReadinessBar'
import PolarMap from '../components/PolarMap'
import StatusBadge from '../components/StatusBadge'
import Assistant from '../components/Assistant'

async function loadAll() {
  const [summary, alerts, stations, personnel, expeditions] = await Promise.all([
    api.getDashboardSummary(),
    api.getAlerts(),
    api.listStations(),
    api.listPersonnel(),
    api.listExpeditions(),
  ])
  const expeditionDetails = await Promise.all(
    expeditions.map((e) => api.getExpedition(e.id).catch(() => null))
  )
  return { summary, alerts, stations, personnel, expeditions: expeditionDetails.filter(Boolean) }
}

const SEVERITY_TONE = {
  critical: 'border-red-500/50 bg-red-500/10',
  high: 'border-orange-500/40 bg-orange-500/10',
  medium: 'border-amber-500/40 bg-amber-500/10',
  low: 'border-slate-500/40 bg-slate-500/10',
}

export default function Dashboard({ navigate }) {
  const { data, loading, error, reload } = useFetch(loadAll, [])
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState(null)

  const downloadReport = async () => {
    setDownloading(true)
    setDownloadError(null)
    try {
      const blob = await api.getSituationReportBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'polarops_situation_report.pdf'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setDownloadError(err.message)
    } finally {
      setDownloading(false)
    }
  }

  if (loading) return <LoadingState label="Loading command dashboard…" />
  if (error) return <ErrorState message={error} onRetry={reload} />
  if (!data) return null

  const { summary, alerts, stations, personnel, expeditions } = data

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Command Dashboard</h1>
          <p className="text-sm text-slate-500">
            Live status across all expeditions, cargo, inventory, personnel and assets.
          </p>
        </div>
        <button
          onClick={downloadReport}
          disabled={downloading}
          className="px-4 py-2 rounded-lg bg-accent-500 hover:bg-accent-400 disabled:opacity-50 text-white text-sm font-medium transition-colors"
        >
          {downloading ? 'Generating…' : 'Generate Situation Report'}
        </button>
      </div>
      {downloadError && <ErrorState message={downloadError} onRetry={downloadReport} />}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Active Expeditions" value={summary.active_expeditions} />
        <StatCard label="Personnel in Field" value={summary.personnel_in_field} />
        <StatCard label="Cargo in Transit" value={summary.cargo_in_transit} />
        <StatCard label="Low-Stock Alerts" value={summary.low_stock_alerts} tone={summary.low_stock_alerts > 0 ? 'warn' : 'good'} />
        <StatCard label="Open Emergencies" value={summary.open_emergencies} tone={summary.open_emergencies > 0 ? 'danger' : 'good'} />
        <StatCard label="Assets Operational" value={summary.assets_operational_pct} suffix="%" tone={summary.assets_operational_pct >= 80 ? 'good' : 'warn'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-base-900 border border-base-700 rounded-xl p-4">
          <h2 className="text-sm font-medium text-slate-300 mb-3">Polar Map</h2>
          <PolarMap stations={stations} personnel={personnel} expeditions={expeditions} />
        </div>

        <div className="bg-base-900 border border-base-700 rounded-xl p-4">
          <h2 className="text-sm font-medium text-slate-300 mb-4">Mission Readiness</h2>
          <div className="space-y-3">
            <ReadinessBar label="Overall" value={summary.mission_readiness.overall} />
            <div className="h-px bg-base-700 my-2" />
            <ReadinessBar label="Personnel" value={summary.mission_readiness.personnel} />
            <ReadinessBar label="Cargo" value={summary.mission_readiness.cargo} />
            <ReadinessBar label="Inventory" value={summary.mission_readiness.inventory} />
            <ReadinessBar label="Assets" value={summary.mission_readiness.assets} />
            <ReadinessBar label="Emergency" value={summary.mission_readiness.emergency} />
          </div>

          <div className="mt-5 pt-4 border-t border-base-700">
            <h3 className="text-xs font-medium text-slate-500 mb-2">Quick Navigate</h3>
            <div className="flex flex-wrap gap-2">
              {['expeditions', 'cargo', 'inventory', 'personnel', 'emergency', 'assets'].map((p) => (
                <button
                  key={p}
                  onClick={() => navigate(p)}
                  className="text-xs px-2.5 py-1 rounded-md bg-base-800 hover:bg-base-700 text-slate-300 capitalize transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-base-900 border border-base-700 rounded-xl p-4">
          <h2 className="text-sm font-medium text-slate-300 mb-3">
            Prioritized Risk Queue ({alerts.length})
          </h2>
          {alerts.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">No active risks — every module is green.</p>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {alerts.map((a) => (
                <div
                  key={a.id}
                  className={`border rounded-lg px-3 py-2.5 ${SEVERITY_TONE[a.severity] || SEVERITY_TONE.low} ${
                    a.type === 'correlated_risk' ? 'ring-1 ring-accent-500/50' : ''
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <StatusBadge value={a.severity} />
                    <span className="text-xs text-slate-500 uppercase tracking-wide">
                      {a.type.replace(/_/g, ' ')}
                      {a.type === 'correlated_risk' && ' · cross-system'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-200">{a.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <Assistant />
      </div>
    </div>
  )
}
