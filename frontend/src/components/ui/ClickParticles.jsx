import { useEffect, useState } from "react";
import { Snowflake, Star } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

let nextId = 0;
export default function ClickParticles() {
  const { theme } = useTheme();
  const [particles, setParticles] = useState([]);
  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const timers = new Set();
    const click = (event) => {
      if (motion.matches || event.detail === 0) return;
      const id = nextId++;
      const particle = { id, x: event.clientX, y: event.clientY, dark: theme === "dark", color: ["#95ffce", "#b5a0ff", "#80e7ff"][id % 3] };
      setParticles((items) => [...items.slice(-23), particle]);
      const timer = setTimeout(() => {
        setParticles((items) => items.filter((item) => item.id !== id));
        timers.delete(timer);
      }, 2000);
      timers.add(timer);
    };
    document.addEventListener("click", click);
    return () => {
      document.removeEventListener("click", click);
      timers.forEach(clearTimeout);
      setParticles([]);
    };
  }, [theme]);
  return <div className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden" aria-hidden="true">
    {particles.map((p) => {
      const Icon = p.dark ? Star : Snowflake;
      return <Icon key={p.id} size={16} strokeWidth={1.6} className={`click-particle ${p.dark ? "click-star" : "click-snow"}`}
        style={{ left: p.x - 8, top: p.y - 8, color: p.dark ? p.color : "#fff", fill: p.dark ? p.color : "none" }} />;
    })}
  </div>;
}
