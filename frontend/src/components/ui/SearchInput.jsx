import { Search } from "lucide-react";

export default function SearchInput({ value, onChange, placeholder = "Search…" }) {
  return (
    <div className="relative w-full sm:w-64">
      <Search size={16} strokeWidth={1.75} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="focus-ring w-full rounded-xl border border-border bg-surface-solid py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-secondary/60"
      />
    </div>
  );
}
