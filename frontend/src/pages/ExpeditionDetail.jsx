import { useParams, useNavigate, Link } from "react-router-dom";
import { Map as MapIcon, Trash2 } from "lucide-react";
import DetailShell from "../components/ui/DetailShell";
import StatusBadge from "../components/ui/StatusBadge";
import TrendChart from "../components/ui/TrendChart";
import { useQuery } from "../hooks/useApi";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import ExpeditionSafetyPanel from "../components/expeditions/ExpeditionSafetyPanel";

const STATUS_TONE = { Active: "ok", Planned: "neutral", Completed: "neutral" };
const RISK_TONE = { low: "ok", medium: "warning", high: "critical" };

export default function ExpeditionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { showToast } = useToast();

  const { data, error, refetch } = useQuery(() => api.get(`/expeditions/${id}`), [id]);
  const { data: stationsResult } = useQuery(() => api.get("/stations"), []);
  const { data: trendResult } = useQuery(() => api.get(`/expeditions/${id}/risk-trend`), [id]);
  const stationsById = Object.fromEntries((stationsResult?.data ?? []).map((s) => [s.id, s]));

  const expedition = data?.data;
  const trend = (trendResult?.data ?? []).map((point) => ({
    date: new Date(`${point.time}Z`).toLocaleString([], { weekday: "short", hour: "2-digit" }),
    risk_score: point.risk_score,
  }));

  const handleDelete = async () => {
    if (!window.confirm("Delete this expedition? This cannot be undone.")) return;
    try {
      await api.delete(`/expeditions/${id}`);
      showToast("Expedition deleted.");
      navigate("/expeditions");
    } catch (err) {
      showToast(err.message, { variant: "error" });
    }
  };

  if (error) return <DetailShell backTo="/expeditions" backLabel="Back to Expeditions" title="Expedition unavailable"><p role="alert" className="text-status-critical">{error.message}</p><button className="text-accent" onClick={refetch}>Retry</button></DetailShell>;
  if (!expedition) {
    return (
      <DetailShell backTo="/expeditions" backLabel="Back to Expeditions" title="Loading…">
        <p className="text-sm text-text-secondary">Fetching expedition details…</p>
      </DetailShell>
    );
  }

  return (
    <DetailShell
      backTo="/expeditions"
      backLabel="Back to Expeditions"
      title={expedition.name}
      subtitle={`${expedition.region} · Led by ${expedition.team_lead}`}
      action={
        <div className="flex items-center gap-3">
          <StatusBadge label={expedition.status} tone={STATUS_TONE[expedition.status]} />
          {expedition.risk_band && (
            <StatusBadge
              label={`${expedition.risk_band} risk (${expedition.risk_score})`}
              tone={RISK_TONE[expedition.risk_band]}
            />
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={handleDelete}
              aria-label="Delete expedition"
              className="focus-ring flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text-secondary transition-colors duration-150 hover:border-status-critical hover:text-status-critical"
            >
              <Trash2 size={16} strokeWidth={1.75} />
            </button>
          )}
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs text-text-secondary">Start date</p>
          <p className="text-sm font-medium text-text-primary">{expedition.start_date}</p>
        </div>
        <div>
          <p className="text-xs text-text-secondary">End date</p>
          <p className="text-sm font-medium text-text-primary">{expedition.end_date || "—"}</p>
        </div>
        <div>
          <p className="text-xs text-text-secondary">Team lead</p>
          <p className="text-sm font-medium text-text-primary">{expedition.team_lead}</p>
        </div>
        <div>
          <p className="text-xs text-text-secondary">Route distance</p>
          <p className="text-sm font-medium text-text-primary">
            {expedition.route_distance_km != null ? `${expedition.route_distance_km} km` : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-text-secondary">Estimated cargo footprint</p>
          <p className="text-sm font-medium text-text-primary" title="Route distance × assigned cargo weight × a standard logistics emission factor">
            {expedition.estimated_emissions_kg != null ? `${expedition.estimated_emissions_kg} kg CO₂` : "—"}
          </p>
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <p className="mb-2 text-xs text-text-secondary">Route waypoints</p>
        {expedition.waypoints.length === 0 ? (
          <p className="text-sm text-text-secondary">No waypoints set.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {expedition.waypoints.map((stationId, idx) => (
              <span key={`${stationId}-${idx}`} className="flex items-center gap-2">
                <span className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-text-primary">
                  {stationsById[stationId]?.name ?? stationId}
                </span>
                {idx < expedition.waypoints.length - 1 && <span className="text-text-secondary">→</span>}
              </span>
            ))}
          </div>
        )}
        <Link
          to="/map"
          className="focus-ring mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
        >
          <MapIcon size={14} strokeWidth={1.75} />
          View on map
        </Link>
      </div>

      <ExpeditionSafetyPanel key={JSON.stringify([id, expedition.personnel_ids, expedition.asset_ids, expedition.emergency_kit_id])} expedition={expedition} onChange={refetch} />
      <TrendChart
        title="Route risk — next 3 days"
        subtitle="Forecast weather along the route, not just today's reading — a dip means a safer departure window."
        data={trend}
        dataKey="risk_score"
        yLabel="Risk score"
      />
    </DetailShell>
  );
}
