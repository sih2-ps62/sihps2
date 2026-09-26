import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Pencil, Trash2 } from "lucide-react";
import DetailShell from "../components/ui/DetailShell";
import StatusBadge from "../components/ui/StatusBadge";
import Field, { inputClass } from "../components/ui/FormField";
import { useQuery } from "../hooks/useApi";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

function stockTone(item) {
  if (item.quantity === 0) return "critical";
  if (item.quantity <= item.threshold) return "warning";
  return "ok";
}

export default function InventoryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { showToast } = useToast();

  const { data, isLoading, refetch } = useQuery(() => api.get(`/inventory/${id}`), [id]);
  const item = data?.data;

  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState(null);

  useEffect(() => {
    if (item) setForm({ quantity: item.quantity, threshold: item.threshold, needs_maintenance: item.needs_maintenance });
  }, [item]);

  const handleSave = async () => {
    try {
      await api.patch(`/inventory/${id}`, {
        quantity: Number(form.quantity),
        threshold: Number(form.threshold),
        needs_maintenance: form.needs_maintenance,
      });
      showToast("Inventory item updated.");
      setIsEditing(false);
      refetch();
    } catch (err) {
      showToast(err.message, { variant: "error" });
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this inventory item? This cannot be undone.")) return;
    try {
      await api.delete(`/inventory/${id}`);
      showToast("Inventory item deleted.");
      navigate("/inventory");
    } catch (err) {
      showToast(err.message, { variant: "error" });
    }
  };

  if (isLoading || !item || !form) {
    return (
      <DetailShell backTo="/inventory" backLabel="Back to Inventory" title="Loading…">
        <p className="text-sm text-text-secondary">Fetching item details…</p>
      </DetailShell>
    );
  }

  return (
    <DetailShell
      backTo="/inventory"
      backLabel="Back to Inventory"
      title={item.name}
      subtitle={item.category}
      action={
        <div className="flex items-center gap-3">
          <StatusBadge label={`${item.quantity}/${item.threshold} ${item.unit}`} tone={stockTone(item)} />
          <button
            type="button"
            onClick={() => setIsEditing((v) => !v)}
            aria-label="Edit item"
            className="focus-ring flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text-secondary transition-colors duration-150 hover:border-accent hover:text-accent"
          >
            <Pencil size={16} strokeWidth={1.75} />
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={handleDelete}
              aria-label="Delete item"
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
            <Field label="Quantity">
              <input
                type="number"
                className={inputClass}
                value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
              />
            </Field>
            <Field label="Low-stock threshold">
              <input
                type="number"
                className={inputClass}
                value={form.threshold}
                onChange={(e) => setForm((f) => ({ ...f, threshold: e.target.value }))}
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-text-primary">
            <input
              type="checkbox"
              checked={form.needs_maintenance}
              onChange={(e) => setForm((f) => ({ ...f, needs_maintenance: e.target.checked }))}
              className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
            />
            Needs maintenance
          </label>
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
            <p className="text-xs text-text-secondary">Quantity</p>
            <p className="text-sm font-medium text-text-primary">
              {item.quantity} {item.unit}
            </p>
          </div>
          <div>
            <p className="text-xs text-text-secondary">Low-stock threshold</p>
            <p className="text-sm font-medium text-text-primary">
              {item.threshold} {item.unit}
            </p>
          </div>
          <div>
            <p className="text-xs text-text-secondary">Maintenance</p>
            <p className="text-sm font-medium text-text-primary">{item.needs_maintenance ? "Needs attention" : "OK"}</p>
          </div>
        </div>
      )}
    </DetailShell>
  );
}
