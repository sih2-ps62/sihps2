import { useState } from "react";
import { Siren, ShieldAlert, Clock, CheckCircle2 } from "lucide-react";
import Button from "../components/ui/Button";
import StatStrip from "../components/ui/StatStrip";
import FilterChip from "../components/ui/FilterChip";
import ReportEmergencyModal from "../components/emergency/ReportEmergencyModal";
import CompoundRiskCard from "../components/emergency/CompoundRiskCard";
import { useQuery } from "../hooks/useApi";
import { api } from "../lib/api";
import { formatRelativeTime } from "../lib/format";
import { useToast } from "../context/ToastContext";
import { buildConditions, computeCompoundRisks } from "../lib/compoundRisk";

const emergencyStatItems = [
  { id: "open", statKey: "openEmergencies", label: "Open Emergencies", icon: ShieldAlert },
  { id: "response", statKey: "avgResponseTimeHours", label: "Avg. Response Time (hrs)", icon: Clock },
  { id: "resolved", statKey: "resolvedLast30d", label: "Resolved (30d)", icon: CheckCircle2 },
];

const severityDot = { critical: "bg-status-critical", warning: "bg-status-warning", resolved: "bg-status-ok" };

export default function Emergency() {
  const { showToast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState("Open");

  const { data: statsResult } = useQuery(() => api.get("/stats"), []);
  const statItemsWithValues = emergencyStatItems.map((item) => ({
    ...item,
    value: statsResult?.emergency?.[item.statKey],
  }));

  const { data: stationsResult } = useQuery(() => api.get("/stations"), []);
  const stations = stationsResult?.data ?? [];
  const stationsById = Object.fromEntries(stations.map((s) => [s.id, s]));

  const { data, isLoading, refetch } = useQuery(
    () => api.get("/emergencies", { status: activeFilter === "All" ? undefined : activeFilter, pageSize: 20 }),
    [activeFilter]
  );

  // Compound Risk correlation sources — independent of the regular list's
  // activeFilter, since a resolved-and-filtered-out emergency shouldn't stop
  // being counted here if it's still genuinely open elsewhere.
  const { data: inventoryResult } = useQuery(() => api.get("/inventory", { pageSize: 100 }), []);
  const { data: personnelResult } = useQuery(() => api.get("/personnel", { pageSize: 100, status: "In Field" }), []);
  const { data: openEmergenciesResult } = useQuery(() => api.get("/emergencies", { status: "Open", pageSize: 100 }), []);

  const compoundRisks = computeCompoundRisks(
    buildConditions({
      inventory: inventoryResult?.data ?? [],
      personnel: personnelResult?.data ?? [],
      emergencies: openEmergenciesResult?.data ?? [],
    })
  );

  const handleResolve = async (id) => {
    try {
      await api.patch(`/emergencies/${id}`, { status: "Resolved" });
      showToast("Marked as resolved.");
      refetch();
    } catch (err) {
      showToast(err.message, { variant: "error" });
    }
  };

  const rows = data?.data ?? [];

  return (
    <div className="flex flex-col gap-4 px-6 py-6 md:px-8">
      <StatStrip items={statItemsWithValues} delay={0} />
      <div className="flex justify-end">
        <Button variant="critical" icon={Siren} onClick={() => setIsModalOpen(true)}>
          Report Emergency
        </Button>
      </div>

      {compoundRisks.length > 0 && (
        <div className="flex flex-col gap-4">
          {compoundRisks.map((risk, idx) => (
            <CompoundRiskCard
              key={risk.stationId}
              stationName={stationsById[risk.stationId]?.name ?? risk.stationId}
              risk={risk}
              delay={idx * 80}
            />
          ))}
        </div>
      )}

      <div className="glass-card flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Incident Timeline</h2>
            <p className="text-sm text-text-secondary">Open cases · response log · resolutions</p>
          </div>
          <div className="flex gap-2">
            {["Open", "Resolved", "All"].map((filter) => (
              <FilterChip
                key={filter}
                label={filter}
                active={activeFilter === filter}
                onClick={() => setActiveFilter(filter)}
              />
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {isLoading && <p className="text-sm text-text-secondary">Loading…</p>}
          {!isLoading && rows.length === 0 && (
            <p className="text-sm text-text-secondary">No incidents match this filter.</p>
          )}
          {rows.map((row) => (
            <div key={row.id} className="flex items-center gap-3 rounded-xl border border-border/60 p-3">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${severityDot[row.severity]}`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text-primary">{row.title}</p>
                <p className="truncate text-xs text-text-secondary">
                  {row.station_name || "Unassigned"} · {formatRelativeTime(row.reported_at)}
                </p>
              </div>
              {row.status === "Open" ? (
                <button
                  type="button"
                  onClick={() => handleResolve(row.id)}
                  className="focus-ring shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-secondary transition-colors duration-150 hover:border-status-ok hover:text-status-ok"
                >
                  Resolve
                </button>
              ) : (
                <span className="shrink-0 text-xs font-medium text-status-ok">Resolved</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <ReportEmergencyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        stations={stations}
        onCreated={refetch}
      />
    </div>
  );
}
