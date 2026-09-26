import { useState } from "react";
import Modal from "../ui/Modal";
import Field, { inputClass } from "../ui/FormField";
import { api } from "../../lib/api";
import { useToast } from "../../context/ToastContext";

const EMPTY_FORM = { manifest_id: "", description: "", status: "Pending", origin: "", destination: "", weight_kg: "" };

export default function NewCargoModal({ isOpen, onClose, onCreated }) {
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
    if (!form.manifest_id || !form.description || !form.origin || !form.destination) {
      setError("Manifest ID, description, origin and destination are required.");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post("/cargo", { ...form, weight_kg: Number(form.weight_kg) || 0 });
      showToast("Cargo record created.");
      onCreated?.();
      handleClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="New Cargo Manifest">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Manifest ID">
            <input className={inputClass} value={form.manifest_id} onChange={update("manifest_id")} placeholder="MAN-1050" />
          </Field>
          <Field label="Status">
            <select className={inputClass} value={form.status} onChange={update("status")}>
              <option>Pending</option>
              <option>In Transit</option>
              <option>Delivered</option>
              <option>Delayed</option>
            </select>
          </Field>
        </div>
        <Field label="Description">
          <input className={inputClass} value={form.description} onChange={update("description")} placeholder="e.g. Fuel drums" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Origin">
            <input className={inputClass} value={form.origin} onChange={update("origin")} />
          </Field>
          <Field label="Destination">
            <input className={inputClass} value={form.destination} onChange={update("destination")} />
          </Field>
        </div>
        <Field label="Weight (kg)">
          <input type="number" min="0" className={inputClass} value={form.weight_kg} onChange={update("weight_kg")} />
        </Field>

        {error && <p className="text-xs font-medium text-status-critical">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="focus-ring mt-1 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Creating…" : "Create Manifest"}
        </button>
      </form>
    </Modal>
  );
}
