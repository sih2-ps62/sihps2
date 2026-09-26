import { useEffect, useRef, useState } from "react";
import { Snowflake } from "lucide-react";

let idCounter = 0;
const ICON_SIZE = 18;
const LIFETIME_MS = 800;

export default function ClickSnowflakes() {
  const [flakes, setFlakes] = useState([]);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = mql.matches;
    const handleChange = (event) => {
      reducedMotionRef.current = event.matches;
    };
    mql.addEventListener("change", handleChange);

    const handleClick = (event) => {
      if (reducedMotionRef.current) return;
      const id = idCounter++;
      setFlakes((prev) => [...prev, { id, x: event.clientX, y: event.clientY }]);
      setTimeout(() => {
        setFlakes((prev) => prev.filter((flake) => flake.id !== id));
      }, LIFETIME_MS);
    };
    document.addEventListener("click", handleClick);

    return () => {
      mql.removeEventListener("change", handleChange);
      document.removeEventListener("click", handleClick);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999]" aria-hidden="true">
      {flakes.map((flake) => (
        <Snowflake
          key={flake.id}
          size={ICON_SIZE}
          strokeWidth={1.75}
          className="absolute text-accent animate-snowflake-pop"
          style={{ left: flake.x - ICON_SIZE / 2, top: flake.y - ICON_SIZE / 2 }}
        />
      ))}
    </div>
  );
}
