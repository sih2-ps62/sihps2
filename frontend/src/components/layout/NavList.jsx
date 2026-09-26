import { useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";

export default function NavList({ items, forceLabels = false, onNavigate }) {
  const location = useLocation();
  const itemRefs = useRef({});
  const [spotlight, setSpotlight] = useState({ top: 0, height: 0, ready: false });

  const activeItem = items.find((item) =>
    item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path)
  );
  const activeId = activeItem?.id;

  useLayoutEffect(() => {
    const el = itemRefs.current[activeId];
    if (el) {
      setSpotlight({ top: el.offsetTop, height: el.offsetHeight, ready: true });
    }
  }, [activeId]);

  return (
    <nav className="relative flex flex-col gap-1 px-3">
      <div
        aria-hidden="true"
        className="absolute left-3 right-3 rounded-xl bg-accent-soft transition-[top,height,opacity] duration-[250ms] ease-out"
        style={{ top: spotlight.top, height: spotlight.height, opacity: spotlight.ready ? 1 : 0 }}
      />
      {items.map((item, idx) => {
        const isActive = item.id === activeId;
        const Icon = item.icon;
        return (
          <Link
            key={item.id}
            to={item.path}
            ref={(el) => {
              itemRefs.current[item.id] = el;
            }}
            onClick={() => onNavigate?.()}
            style={{ animationDelay: `${40 * (idx + 1)}ms` }}
            className={`animate-fade-slide-up focus-ring group relative z-10 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200 ${
              isActive ? "text-accent" : "text-text-secondary hover:text-text-primary"
            }`}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon size={20} strokeWidth={1.75} className="shrink-0" />
            <span className={forceLabels ? "inline" : "hidden lg:inline"}>{item.label}</span>
            {!forceLabels && (
              <span className="pointer-events-none absolute left-full top-1/2 z-20 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-text-primary px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 lg:hidden">
                {item.label}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
