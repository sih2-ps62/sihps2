function barColor(pct) {
  if (pct >= 80) return 'bg-emerald-500'
  if (pct >= 60) return 'bg-amber-500'
  return 'bg-red-500'
}

export default function ReadinessBar({ label, value }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-400 capitalize">{label}</span>
        <span className="text-slate-300 font-medium">{value}%</span>
      </div>
      <div className="h-1.5 bg-base-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor(value)} transition-all duration-500`}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  )
}
