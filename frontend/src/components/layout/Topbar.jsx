import { useEffect, useState } from "react";
import { Menu, MoonStar, RefreshCw, Search, Settings, Sun, WifiOff } from "lucide-react";
import { Link } from "react-router-dom";
import { getBlackoutState, subscribeBlackout, toggleBlackout } from "../../lib/api";
import { useTheme } from "../../context/ThemeContext";

function formatTimer(totalSeconds) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function BlackoutStatusPill() {
  const [state, setState] = useState(() => getBlackoutState());

  useEffect(() => subscribeBlackout(setState), []);

  // The subscription fires on queue/mode changes, but the timer needs to
  // tick every second on its own while active.
  useEffect(() => {
    if (!state.active) return undefined;
    const interval = setInterval(() => setState(getBlackoutState()), 1000);
    return () => clearInterval(interval);
  }, [state.active]);

  return (
    <button
      type="button"
      onClick={() => toggleBlackout()}
      title={state.active ? "Click to restore connection (simulated)" : "Click to simulate a connectivity loss"}
      className={`focus-ring flex items-center gap-2 rounded-full border px-3 py-1.5 transition-colors duration-200 ${
        state.active ? "border-status-critical/30 bg-status-critical/10" : "border-border bg-surface"
      }`}
    >
      {state.active ? (
        <>
          <WifiOff size={14} strokeWidth={1.75} className="text-status-critical" />
          <span className="text-xs font-semibold tracking-wide text-status-critical">
            POLAR BLACKOUT MODE — {formatTimer(state.elapsedSeconds)} offline
          </span>
        </>
      ) : (
        <>
          <span className="h-2 w-2 rounded-full bg-status-ok" aria-hidden="true" />
          <span className="text-xs font-semibold tracking-wide text-text-primary">SYSTEM ONLINE</span>
        </>
      )}
    </button>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? "Switch to Frost (light)" : "Switch to Aurora (dark)"}
      aria-label="Toggle theme"
      aria-pressed={isDark}
      className="focus-ring flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-3 text-accent transition-colors duration-200 hover:text-text-primary"
    >
      {isDark ? <Sun size={16} strokeWidth={1.75} /> : <MoonStar size={16} strokeWidth={1.75} />}
      <span className="hidden text-xs font-semibold xl:inline">{isDark ? "Aurora" : "Frost"}</span>
    </button>
  );
}

export default function Topbar({ title, subtitle, onOpenMenu, onOpenCommandPalette }) {
  return (
    <header
      style={{ animationDelay: "40ms" }}
      className="animate-fade-slide-up flex flex-col gap-4 border-b border-border px-6 py-5 sm:flex-row sm:items-center sm:justify-between md:px-8"
    >
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Open navigation menu"
          className="focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-text-primary md:hidden"
        >
          <Menu size={20} strokeWidth={1.75} />
        </button>
        <div>
          <h1 className="text-3xl font-semibold text-text-primary">{title}</h1>
          <p className="text-sm text-text-secondary">{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="focus-ring hidden items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors duration-200 hover:text-text-primary sm:flex"
        >
          <Search size={14} strokeWidth={1.75} />
          <span>Search</span>
          <kbd className="rounded border border-border bg-surface-solid px-1.5 py-0.5 font-sans text-[10px] text-text-secondary">
            ⌘K
          </kbd>
        </button>
        <BlackoutStatusPill />
        <div className="hidden items-center gap-1.5 text-sm text-text-secondary md:flex">
          <RefreshCw size={16} strokeWidth={1.75} />
          <span>Last synced —</span>
        </div>
        <ThemeToggle />
        <Link
          to="/settings"
          aria-label="Settings"
          className="focus-ring flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-text-secondary transition-colors duration-200 hover:text-text-primary"
        >
          <Settings size={16} strokeWidth={1.75} />
        </Link>
      </div>
    </header>
  );
}
