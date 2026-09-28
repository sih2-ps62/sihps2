import { useEffect, useRef, useState } from "react";
import { MoonStar, Snowflake, X } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

const KEY = "polarops.theme-discovery";
export default function ThemeDiscovery() {
  const { theme, toggleTheme } = useTheme();
  const [visible, setVisible] = useState(false);
  const initialTheme = useRef(theme);
  const stopped = useRef(false);
  useEffect(() => {
    try { stopped.current = sessionStorage.getItem(KEY) === "done"; } catch { /* memory fallback */ }
    const show = () => { if (!stopped.current) setVisible(true); };
    const timers = [setTimeout(show, 6000), setTimeout(() => setVisible(false), 24000), setTimeout(show, 180000)];
    return () => timers.forEach(clearTimeout);
  }, []);
  const stop = () => {
    stopped.current = true;
    setVisible(false);
    try { sessionStorage.setItem(KEY, "done"); } catch { /* memory fallback */ }
  };
  useEffect(() => {
    if (theme !== initialTheme.current) stop();
  }, [theme]);
  if (!visible) return null;
  const dark = theme === "dark";
  const Icon = dark ? Snowflake : MoonStar;
  return <aside className="theme-discovery animate-fade-slide-up" aria-label="Try another theme" role="status">
    <div className={`theme-preview ${dark ? "theme-preview-frost" : "theme-preview-aurora"}`}><Icon size={22} /></div>
    <div className="min-w-0 flex-1">
      <p className="text-sm font-semibold text-text-primary">A different view of the poles</p>
      <p className="mt-1 text-xs text-text-secondary">{dark ? "Try the bright, icy calm of Frost." : "Meet Aurora. Northern lights, after dark."}</p>
      <button type="button" className="focus-ring mt-2 rounded-lg text-xs font-semibold text-accent"
        onClick={() => { toggleTheme(); stop(); }}>Try {dark ? "Frost" : "Aurora"} →</button>
    </div>
    <button type="button" onClick={stop} className="focus-ring rounded-lg p-1 text-text-secondary" aria-label="Dismiss theme suggestion"><X size={16} /></button>
  </aside>;
}
