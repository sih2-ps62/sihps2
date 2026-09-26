import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { navItems } from "../../data/navigation";

export default function CommandPalette({ isOpen, onClose }) {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const results = navItems.filter((item) => item.label.toLowerCase().includes(query.trim().toLowerCase()));

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setActiveIndex(0);
      const timeout = setTimeout(() => inputRef.current?.focus(), 10);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [isOpen]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!isOpen) return null;

  const handleSelect = (item) => {
    navigate(item.path);
    onClose();
  };

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      onClose();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter" && results[activeIndex]) {
      handleSelect(results[activeIndex]);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-start justify-center px-4 pt-24"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <button
        type="button"
        aria-label="Close command palette"
        onClick={onClose}
        className="absolute inset-0 bg-text-primary/40 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-lg animate-fade-slide-up overflow-hidden rounded-2xl border border-border bg-surface-solid shadow-glass-hover">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search size={18} strokeWidth={1.75} className="text-text-secondary" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Jump to a page…"
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-secondary/60 focus:outline-none"
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] text-text-secondary">Esc</kbd>
        </div>
        <div className="thin-scroll max-h-80 overflow-y-auto p-2">
          {results.length === 0 && <p className="px-3 py-6 text-center text-sm text-text-secondary">No matches.</p>}
          {results.map((item, idx) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setActiveIndex(idx)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors duration-150 ${
                  idx === activeIndex ? "bg-accent-soft text-accent" : "text-text-primary hover:bg-accent-soft/50"
                }`}
              >
                <Icon size={18} strokeWidth={1.75} />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
