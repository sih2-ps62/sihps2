export const inputClass =
  "focus-ring w-full rounded-xl border border-border bg-surface-solid px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/60";

export default function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-text-secondary">{label}</span>
      {children}
    </label>
  );
}
