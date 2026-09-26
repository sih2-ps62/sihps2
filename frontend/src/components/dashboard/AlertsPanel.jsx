import { Link } from "react-router-dom";
import Reveal from "../ui/Reveal";
import { useQuery } from "../../hooks/useApi";
import { api } from "../../lib/api";
import { formatRelativeTime } from "../../lib/format";

const statusDot = {
  critical: "bg-status-critical",
  warning: "bg-status-warning",
  ok: "bg-status-ok",
};

export default function AlertsPanel() {
  const { data, isLoading } = useQuery(
    () =>
      Promise.all([
        api.get("/emergencies", { status: "Open", pageSize: 5, sort: "reported_at", order: "desc" }),
        api.get("/inventory", { lowStock: "true", pageSize: 5 }),
      ]),
    []
  );

  const feed = (() => {
    if (!data) return [];
    const [emergencies, lowStock] = data;
    const emergencyRows = (emergencies?.data ?? []).map((e) => ({
      id: `emergency-${e.id}`,
      severity: e.severity === "critical" ? "critical" : "warning",
      text: e.title,
      meta: e.station_name || "Unassigned",
      timestamp: e.reported_at,
      to: "/emergency",
    }));
    const stockRows = (lowStock?.data ?? []).map((item) => ({
      id: `inventory-${item.id}`,
      severity: item.quantity === 0 ? "critical" : "warning",
      text: `${item.name} — low stock`,
      meta: `${item.quantity}/${item.threshold} ${item.unit}`,
      timestamp: item.updated_at,
      to: "/inventory",
    }));
    return [...emergencyRows, ...stockRows]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 6);
  })();

  return (
    <Reveal delay={200} className="glass-card flex min-h-[420px] max-h-[420px] flex-col p-5">
      <div className="mb-4 shrink-0">
        <h2 className="text-lg font-semibold text-text-primary">Live Operational Feed</h2>
        <p className="text-sm text-text-secondary">Low stock · emergencies</p>
      </div>
      <div className="thin-scroll flex-1 space-y-3 overflow-y-auto pr-1">
        {isLoading && <p className="px-1 text-sm text-text-secondary">Loading…</p>}
        {!isLoading && feed.length === 0 && (
          <p className="px-1 text-sm text-text-secondary">Nothing needs attention right now.</p>
        )}
        {feed.map((row) => (
          <Link
            key={row.id}
            to={row.to}
            className="focus-ring flex items-center gap-3 rounded-xl border border-border/60 p-3 transition-colors duration-150 hover:bg-accent-soft/40"
          >
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${statusDot[row.severity]}`} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text-primary">{row.text}</p>
              <p className="truncate text-xs text-text-secondary">{row.meta}</p>
            </div>
            <span className="shrink-0 text-xs text-text-secondary">{formatRelativeTime(row.timestamp)}</span>
          </Link>
        ))}
      </div>
    </Reveal>
  );
}
