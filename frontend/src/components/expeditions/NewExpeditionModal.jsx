import { useState } from "react";
import Modal from "../ui/Modal";
import Field, { inputClass } from "../ui/FormField";
import { api } from "../../lib/api";
import { useToast } from "../../context/ToastContext";

const EMPTY_FORM = { name: "", status: "Planned", region: "Antarctic", start_date: "", team_lead: "", origin: "", destination: "" };

export default function NewExpeditionModal({ isOpen, onClose, stations, onCreated }) {
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
    if (!form.name || !form.start_date || !form.team_lead) {
      setError("Name, start date and team lead are required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const waypoints = [form.origin, form.destination].filter(Boolean);
      await api.post("/expeditions", { ...form, waypoints });
      showToast("Expedition created.");
      onCreated?.();
      handleClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="New Expedition">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field label="Name">
          <input className={inputClass} value={form.name} onChange={update("name")} placeholder="e.g. Ross Ice Shelf Traverse" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Status">
            <select className={inputClass} value={form.status} onChange={update("status")}>
              <option>Planned</option>
            </select>
          </Field>
          <Field label="Region">
            <select className={inputClass} value={form.region} onChange={update("region")}>
              <option>Antarctic</option>
              <option>Arctic</option>
            </select>
          </Field>
        </div>

        <p className="text-xs text-text-secondary">New expeditions start as Planned. Open the expedition to assign crew, attach its emergency kit and pass the departure gate.</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date">
            <input type="date" className={inputClass} value={form.start_date} onChange={update("start_date")} />
          </Field>
          <Field label="Team lead">
            <input className={inputClass} value={form.team_lead} onChange={update("team_lead")} placeholder="Name" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="From station">
            <select className={inputClass} value={form.origin} onChange={update("origin")}>
              <option value="">—</option>
              {stations.map((station) => (
                <option key={station.id} value={station.id}>
                  {station.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="To station">
            <select className={inputClass} value={form.destination} onChange={update("destination")}>
              <option value="">—</option>
              {stations.map((station) => (
                <option key={station.id} value={station.id}>
                  {station.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {error && <p className="text-xs font-medium text-status-critical">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="focus-ring mt-1 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Creating…" : "Create Expedition"}
        </button>
      </form>
    </Modal>
  );
}
