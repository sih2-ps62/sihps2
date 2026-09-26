import { statItems } from "../../data/stats";
import Reveal from "../ui/Reveal";
import { useQuery } from "../../hooks/useApi";
import { api } from "../../lib/api";

export default function StatRow() {
  const { data, isLoading } = useQuery(() => api.get("/stats"), []);
  const dashboard = data?.dashboard;

  return (
    <Reveal delay={120} className="glass-card overflow-x-auto thin-scroll">
      <div className="flex divide-x divide-border md:grid md:grid-cols-5">
        {statItems.map((item) => {
          const Icon = item.icon;
          const value = dashboard?.[item.statKey];
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
                  {isLoading || value == null ? "—" : value}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </Reveal>
  );
}
