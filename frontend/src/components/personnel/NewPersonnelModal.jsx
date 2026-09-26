import { useState } from "react";
import Modal from "../ui/Modal";
import Field, { inputClass } from "../ui/FormField";
import { api } from "../../lib/api";
import { useToast } from "../../context/ToastContext";

const EMPTY_FORM = { name: "", role: "", station_id: "", status: "In Field" };

export default function NewPersonnelModal({ isOpen, onClose, stations, onCreated }) {
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
    if (!form.name || !form.role) {
      setError("Name and role are required.");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post("/personnel", form);
      showToast("Personnel record created.");
      onCreated?.();
      handleClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Personnel">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field label="Name">
          <input className={inputClass} value={form.name} onChange={update("name")} placeholder="Full name" />
        </Field>
        <Field label="Role">
          <input className={inputClass} value={form.role} onChange={update("role")} placeholder="e.g. Field Medic" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Station">
            <select className={inputClass} value={form.station_id} onChange={update("station_id")}>
              <option value="">—</option>
              {stations.map((station) => (
                <option key={station.id} value={station.id}>
                  {station.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select className={inputClass} value={form.status} onChange={update("status")}>
              <option>In Field</option>
              <option>On Leave</option>
              <option>Base</option>
            </select>
          </Field>
        </div>

        {error && <p className="text-xs font-medium text-status-critical">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="focus-ring mt-1 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Adding…" : "Add Personnel"}
        </button>
      </form>
    </Modal>
  );
}
