import { useParams, useNavigate, Link } from "react-router-dom";
import { Map as MapIcon, Trash2 } from "lucide-react";
import DetailShell from "../components/ui/DetailShell";
import StatusBadge from "../components/ui/StatusBadge";
import { useQuery } from "../hooks/useApi";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

const STATUS_TONE = { Active: "ok", Planned: "neutral", Completed: "neutral" };

export default function ExpeditionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { showToast } = useToast();

  const { data, isLoading } = useQuery(() => api.get(`/expeditions/${id}`), [id]);
  const { data: stationsResult } = useQuery(() => api.get("/stations"), []);
  const stationsById = Object.fromEntries((stationsResult?.data ?? []).map((s) => [s.id, s]));

  const expedition = data?.data;

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

  if (isLoading || !expedition) {
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
      </div>

      <div className="border-t border-border pt-4">
        <p className="mb-2 text-xs text-text-secondary">Route waypoints</p>
        {expedition.waypoints.length === 0 ? (
          <p className="text-sm text-text-secondary">No waypoints set.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {expedition.waypoints.map((stationId, idx) => (
              <span key={stationId} className="flex items-center gap-2">
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
    </DetailShell>
  );
}
