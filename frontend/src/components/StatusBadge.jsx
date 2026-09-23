const STYLES = {
  // personnel
  at_base: 'bg-slate-600/30 text-slate-300 border-slate-500/40',
  in_transit: 'bg-blue-600/20 text-blue-300 border-blue-500/40',
  on_expedition: 'bg-teal-600/20 text-teal-300 border-teal-500/40',
  overdue: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  emergency: 'bg-red-600/25 text-red-300 border-red-500/50',

  // generic status
  planned: 'bg-slate-600/30 text-slate-300 border-slate-500/40',
  in_progress: 'bg-blue-600/20 text-blue-300 border-blue-500/40',
  completed: 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40',
  stored: 'bg-slate-600/30 text-slate-300 border-slate-500/40',
  delivered: 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40',
  ok: 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40',
  low: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  operational: 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40',
  warning: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  critical: 'bg-red-600/25 text-red-300 border-red-500/50',
  maintenance: 'bg-purple-600/20 text-purple-300 border-purple-500/40',
  open: 'bg-red-600/25 text-red-300 border-red-500/50',
  responding: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  resolved: 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40',
  at_risk: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  reached: 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40',
  pending: 'bg-slate-600/30 text-slate-300 border-slate-500/40',

  // severity
  medium: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  high: 'bg-orange-500/20 text-orange-300 border-orange-500/40',

  // audit
  info: 'bg-slate-600/30 text-slate-300 border-slate-500/40',
  success: 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40',
  error: 'bg-red-600/25 text-red-300 border-red-500/50',
}

export default function StatusBadge({ value, className = '' }) {
  if (!value) return null
  const style = STYLES[value] || 'bg-slate-600/30 text-slate-300 border-slate-500/40'
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${style} ${className}`}
    >
      {String(value).replace(/_/g, ' ')}
    </span>
  )
}
