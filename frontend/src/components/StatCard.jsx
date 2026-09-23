export default function StatCard({ label, value, tone = 'default', suffix = '' }) {
  const toneClass = {
    default: 'text-white',
    warn: 'text-amber-400',
    danger: 'text-red-400',
    good: 'text-emerald-400',
  }[tone]

  return (
    <div className="bg-base-900 border border-base-700 rounded-xl px-4 py-3.5">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className={`text-2xl font-semibold ${toneClass}`}>
        {value}
        {suffix}
      </div>
    </div>
  )
}
