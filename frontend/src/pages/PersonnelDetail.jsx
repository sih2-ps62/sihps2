import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { CalendarCheck, Pencil, Trash2 } from "lucide-react";
import DetailShell from "../components/ui/DetailShell";
import StatusBadge from "../components/ui/StatusBadge";
import Field, { inputClass } from "../components/ui/FormField";
import { useQuery } from "../hooks/useApi";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { formatRelativeTime } from "../lib/format";
import { isOverdueCheckin } from "../lib/compoundRisk";

const STATUS_TONE = { "In Field": "ok", "On Leave": "neutral", Base: "neutral" };

export default function PersonnelDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { showToast } = useToast();

  const { data, isLoading, refetch } = useQuery(() => api.get(`/personnel/${id}`), [id]);
  const { data: stationsResult } = useQuery(() => api.get("/stations"), []);
  const stations = stationsResult?.data ?? [];
  const person = data?.data;

  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState(null);

  useEffect(() => {
    if (person) setForm({ status: person.status, station_id: person.station_id || "" });
  }, [person]);

  const handleSave = async () => {
    try {
      await api.patch(`/personnel/${id}`, form);
      showToast("Personnel record updated.");
      setIsEditing(false);
      refetch();
    } catch (err) {
      showToast(err.message, { variant: "error" });
    }
  };

  const handleCheckIn = async () => {
    try {
      await api.post(`/personnel/${id}/checkin`);
      showToast("Check-in recorded.");
      refetch();
    } catch (err) {
      showToast(err.message, { variant: "error" });
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Remove this personnel record? This cannot be undone.")) return;
    try {
      await api.delete(`/personnel/${id}`);
      showToast("Personnel record removed.");
      navigate("/personnel");
    } catch (err) {
      showToast(err.message, { variant: "error" });
    }
  };

  if (isLoading || !person || !form) {
    return (
      <DetailShell backTo="/personnel" backLabel="Back to Personnel" title="Loading…">
        <p className="text-sm text-text-secondary">Fetching personnel details…</p>
      </DetailShell>
    );
  }

  return (
    <DetailShell
      backTo="/personnel"
      backLabel="Back to Personnel"
      title={person.name}
      subtitle={person.role}
      action={
        <div className="flex items-center gap-3">
          <StatusBadge label={person.status} tone={STATUS_TONE[person.status]} />
          <button
            type="button"
            onClick={handleCheckIn}
            className="focus-ring flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-secondary transition-colors duration-150 hover:border-accent hover:text-accent"
          >
            <CalendarCheck size={14} strokeWidth={1.75} />
            Check In
          </button>
          <button
            type="button"
            onClick={() => setIsEditing((v) => !v)}
            aria-label="Edit personnel"
            className="focus-ring flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text-secondary transition-colors duration-150 hover:border-accent hover:text-accent"
          >
            <Pencil size={16} strokeWidth={1.75} />
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={handleDelete}
              aria-label="Delete personnel"
              className="focus-ring flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text-secondary transition-colors duration-150 hover:border-status-critical hover:text-status-critical"
            >
              <Trash2 size={16} strokeWidth={1.75} />
            </button>
          )}
        </div>
      }
    >
      {isEditing ? (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Station">
              <select
                className={inputClass}
                value={form.station_id}
                onChange={(e) => setForm((f) => ({ ...f, station_id: e.target.value }))}
              >
                <option value="">—</option>
                {stations.map((station) => (
                  <option key={station.id} value={station.id}>
                    {station.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select
                className={inputClass}
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              >
                <option>In Field</option>
                <option>On Leave</option>
                <option>Base</option>
              </select>
            </Field>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              className="focus-ring rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-accent/90"
            >
              Save changes
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="focus-ring rounded-xl border border-border px-4 py-2 text-sm font-semibold text-text-secondary transition-colors duration-200 hover:text-text-primary"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-text-secondary">Station</p>
            <p className="text-sm font-medium text-text-primary">{person.station_name || "Unassigned"}</p>
          </div>
          <div>
            <p className="text-xs text-text-secondary">Region</p>
            <p className="text-sm font-medium text-text-primary">{person.station_region || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-text-secondary">Last check-in</p>
            <p className="text-sm font-medium text-text-primary">
              {person.last_checkin ? formatRelativeTime(person.last_checkin) : "Never"}
              {isOverdueCheckin(person) && (
                <span className="ml-2 text-xs font-semibold text-status-critical">Overdue</span>
              )}
            </p>
          </div>
        </div>
      )}
    </DetailShell>
  );
}
