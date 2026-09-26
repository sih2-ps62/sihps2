import { useState } from "react";
import Modal from "../ui/Modal";
import Field, { inputClass } from "../ui/FormField";
import { api } from "../../lib/api";
import { useToast } from "../../context/ToastContext";

const EMPTY_FORM = { name: "", category: "", quantity: "", threshold: "", unit: "units", needs_maintenance: false };

export default function NewInventoryModal({ isOpen, onClose, onCreated }) {
  const { showToast } = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const update = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const handleClose = () => {
    setForm(EMPTY_FORM);
    setError("");
    onClose();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    if (!form.name || !form.category) {
      setError("Name and category are required.");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post("/inventory", {
        ...form,
        quantity: Number(form.quantity) || 0,
        threshold: Number(form.threshold) || 0,
      });
      showToast("Inventory item created.");
      onCreated?.();
      handleClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="New Inventory Item">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field label="Name">
          <input className={inputClass} value={form.name} onChange={update("name")} placeholder="e.g. Diesel fuel" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <input className={inputClass} value={form.category} onChange={update("category")} placeholder="e.g. Fuel" />
          </Field>
          <Field label="Unit">
            <input className={inputClass} value={form.unit} onChange={update("unit")} placeholder="units / L / kits" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity">
            <input type="number" min="0" className={inputClass} value={form.quantity} onChange={update("quantity")} />
          </Field>
          <Field label="Low-stock threshold">
            <input type="number" min="0" className={inputClass} value={form.threshold} onChange={update("threshold")} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-text-primary">
          <input
            type="checkbox"
            checked={form.needs_maintenance}
            onChange={(event) => setForm((prev) => ({ ...prev, needs_maintenance: event.target.checked }))}
            className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
          />
          Needs maintenance
        </label>

        {error && <p className="text-xs font-medium text-status-critical">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="focus-ring mt-1 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Creating…" : "Add Item"}
        </button>
      </form>
    </Modal>
  );
}
