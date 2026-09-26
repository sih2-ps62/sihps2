import { useParams, useNavigate } from "react-router-dom";
import { Trash2 } from "lucide-react";
import DetailShell from "../components/ui/DetailShell";
import StatusBadge from "../components/ui/StatusBadge";
import { useQuery } from "../hooks/useApi";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

const STATUS_TONE = { Delivered: "ok", "In Transit": "neutral", Delayed: "warning", Pending: "neutral" };

export default function CargoDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { showToast } = useToast();

  const { data, isLoading } = useQuery(() => api.get(`/cargo/${id}`), [id]);
  const cargo = data?.data;

  const handleDelete = async () => {
    if (!window.confirm("Delete this cargo record? This cannot be undone.")) return;
    try {
      await api.delete(`/cargo/${id}`);
      showToast("Cargo record deleted.");
      navigate("/cargo");
    } catch (err) {
      showToast(err.message, { variant: "error" });
    }
  };

  if (isLoading || !cargo) {
    return (
      <DetailShell backTo="/cargo" backLabel="Back to Cargo" title="Loading…">
        <p className="text-sm text-text-secondary">Fetching cargo details…</p>
      </DetailShell>
    );
  }

  return (
    <DetailShell
      backTo="/cargo"
      backLabel="Back to Cargo"
      title={cargo.manifest_id}
      subtitle={cargo.description}
      action={
        <div className="flex items-center gap-3">
          <StatusBadge label={cargo.status} tone={STATUS_TONE[cargo.status]} />
          {isAdmin && (
            <button
              type="button"
              onClick={handleDelete}
              aria-label="Delete cargo record"
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
          <p className="text-xs text-text-secondary">Origin</p>
          <p className="text-sm font-medium text-text-primary">{cargo.origin}</p>
        </div>
        <div>
          <p className="text-xs text-text-secondary">Destination</p>
          <p className="text-sm font-medium text-text-primary">{cargo.destination}</p>
        </div>
        <div>
          <p className="text-xs text-text-secondary">Weight</p>
          <p className="text-sm font-medium text-text-primary">{cargo.weight_kg} kg</p>
        </div>
      </div>
    </DetailShell>
  );
}
