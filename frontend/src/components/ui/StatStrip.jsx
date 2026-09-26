import Reveal from "./Reveal";

export default function StatStrip({ items, delay = 0 }) {
  return (
    <Reveal delay={delay} className="glass-card overflow-x-auto thin-scroll">
      <div
        className="flex divide-x divide-border md:grid"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              className="flex min-w-[200px] shrink-0 items-center gap-3 px-5 py-4 md:min-w-0 md:shrink"
            >
              <div className="icon-chip">
                <Icon size={18} strokeWidth={1.75} />
              </div>
              <div>
                <p className="text-xs text-text-secondary">{item.label}</p>
                <p className="text-2xl font-semibold tabular-nums text-text-primary">
                  {item.value == null ? "—" : item.value}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </Reveal>
  );
}
