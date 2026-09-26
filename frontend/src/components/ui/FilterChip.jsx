export default function FilterChip({ label, active = false, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`focus-ring rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors duration-200 ${
        active
          ? "border-accent bg-accent-soft text-accent"
          : "border-border bg-surface text-text-secondary hover:text-text-primary"
      }`}
    >
      {label}
    </button>
  );
}
