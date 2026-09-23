export function LoadingState({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center py-16 text-slate-400 gap-3">
      <div className="w-5 h-5 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
      <span>{label}</span>
    </div>
  )
}

export function EmptyState({ label = 'Nothing here yet.', hint }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400 gap-1">
      <p>{label}</p>
      {hint && <p className="text-sm text-slate-500">{hint}</p>}
    </div>
  )
}

export function ErrorState({ message = 'Something went wrong.', onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      <div className="w-10 h-10 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 text-lg">
        !
      </div>
      <p className="text-red-300 max-w-md">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-1.5 rounded-lg bg-accent-500 hover:bg-accent-400 text-white text-sm font-medium transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  )
}
