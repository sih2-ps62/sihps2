const NAV_ITEMS = [
  { page: 'dashboard', label: 'Command Dashboard', icon: '◈' },
  { page: 'expeditions', label: 'Expedition Planner', icon: '⛵' },
  { page: 'cargo', label: 'Cargo Tracker', icon: '▦' },
  { page: 'inventory', label: 'Inventory', icon: '≡' },
  { page: 'personnel', label: 'Personnel', icon: '◎' },
  { page: 'emergency', label: 'Emergency', icon: '⚠' },
  { page: 'assets', label: 'Assets', icon: '⚙' },
  { page: 'audit', label: 'Audit Log', icon: '☷' },
]

export default function Navbar({ current, onNavigate, online }) {
  return (
    <div className="w-64 shrink-0 bg-base-900 border-r border-base-700 flex flex-col h-screen sticky top-0">
      <div className="px-5 py-5 border-b border-base-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent-500 flex items-center justify-center font-bold text-sm">
            PE
          </div>
          <div>
            <div className="font-semibold text-white leading-tight">PolarOps</div>
            <div className="text-xs text-slate-500">Expedition Command</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 py-3 px-2 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.page}
            onClick={() => onNavigate(item.page)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm mb-0.5 transition-colors text-left ${
              current === item.page
                ? 'bg-accent-500/15 text-accent-400 font-medium border border-accent-500/30'
                : 'text-slate-400 hover:bg-base-800 hover:text-slate-200 border border-transparent'
            }`}
          >
            <span className="w-4 text-center">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-base-700">
        <div className="flex items-center gap-2 text-xs">
          <span className={`w-2 h-2 rounded-full ${online ? 'bg-emerald-400' : 'bg-red-500 animate-pulse'}`} />
          <span className="text-slate-400">
            {online ? 'Live — synced' : 'Offline — queued locally'}
          </span>
        </div>
        <div className="text-[11px] text-slate-600 mt-2">
          Position feed & weather are simulated for this demo.
        </div>
      </div>
    </div>
  )
}
