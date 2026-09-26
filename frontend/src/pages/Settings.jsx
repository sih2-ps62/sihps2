import { useState } from "react";
import { Bell, ShieldCheck, UserCircle, Volume2 } from "lucide-react";
import Reveal from "../components/ui/Reveal";
import { useAuth } from "../context/AuthContext";

function usePersistedToggle(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? defaultValue : raw === "true";
    } catch {
      return defaultValue;
    }
  });

  const toggle = () => {
    setValue((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(key, String(next));
      } catch {
        // localStorage unavailable — preference just won't persist
      }
      return next;
    });
  };

  return [value, toggle];
}

function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`focus-ring relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${
        checked ? "bg-accent" : "bg-border"
      }`}
      aria-label={label}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const [emailAlerts, toggleEmailAlerts] = usePersistedToggle("polarops.pref.emailAlerts", true);
  const [soundAlerts, toggleSoundAlerts] = usePersistedToggle("polarops.pref.soundAlerts", false);

  return (
    <div className="flex flex-col gap-4 px-6 py-6 md:px-8">
      <Reveal className="glass-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="icon-chip h-14 w-14">
            <UserCircle size={28} strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-lg font-semibold text-text-primary">{user?.name}</p>
            <p className="text-sm text-text-secondary">{user?.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start rounded-full border border-border bg-accent-soft px-3 py-1.5 sm:self-auto">
          <ShieldCheck size={14} strokeWidth={1.75} className="text-accent" />
          <span className="text-xs font-semibold uppercase tracking-wide text-accent">
            {user?.role === "admin" ? "Admin" : "Duty Officer"}
          </span>
        </div>
      </Reveal>

      <Reveal delay={80} className="glass-card flex flex-col gap-1 p-5">
        <h2 className="mb-3 text-lg font-semibold text-text-primary">Notification preferences</h2>

        <div className="flex items-center justify-between gap-4 border-b border-border/60 py-3">
          <div className="flex items-center gap-3">
            <div className="icon-chip">
              <Bell size={16} strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">Email alerts</p>
              <p className="text-xs text-text-secondary">Get emailed when a new emergency is reported</p>
            </div>
          </div>
          <Toggle checked={emailAlerts} onChange={toggleEmailAlerts} label="Email alerts" />
        </div>

        <div className="flex items-center justify-between gap-4 py-3">
          <div className="flex items-center gap-3">
            <div className="icon-chip">
              <Volume2 size={16} strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">Sound alerts</p>
              <p className="text-xs text-text-secondary">Play a sound for critical status changes</p>
            </div>
          </div>
          <Toggle checked={soundAlerts} onChange={toggleSoundAlerts} label="Sound alerts" />
        </div>
      </Reveal>
    </div>
  );
}
