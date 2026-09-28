import { useState } from "react";
import Modal from "../ui/Modal";
import Field, { inputClass } from "../ui/FormField";
import { api } from "../../lib/api";
import { useToast } from "../../context/ToastContext";
import { useQuery } from "../../hooks/useApi";
import { useNavigate } from "react-router-dom";

const EMPTY_FORM = { title: "", severity: "warning", station_id: "", personnel_id: "" };

export default function ReportEmergencyModal({ isOpen, onClose, stations, onCreated }) {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { data: people } = useQuery(() => isOpen ? api.get("/personnel", { pageSize: 100 }) : Promise.resolve(null), [isOpen]);
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
    if (!form.title) {
      setError("A short description is required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await api.post("/emergencies", form);
      showToast("Emergency reported.");
      onCreated?.();
      handleClose();
      navigate(`/emergency/${result.data.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Report Emergency">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field label="What's happening?">
          <input
            className={inputClass}
            value={form.title}
            onChange={update("title")}
            placeholder="e.g. Generator failure — backup power engaged"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Severity">
            <select className={inputClass} value={form.severity} onChange={update("severity")}>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
            </select>
          </Field>
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
        </div>

        <Field label="Affected person (optional)"><select className={inputClass} value={form.personnel_id} onChange={update("personnel_id")}>
          <option value="">Station-level incident</option>
          {(people?.data || []).map((p) => <option key={p.id} value={p.id}>{p.name} · {p.role}</option>)}
        </select></Field>
        <p className="text-xs text-text-secondary">A person-specific incident provides a gated critical-info card for authorized medical responders.</p>
        {error && <p role="alert" className="text-xs font-medium text-status-critical">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="focus-ring mt-1 rounded-xl bg-status-critical px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-status-critical/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Reporting…" : "Report Emergency"}
        </button>
      </form>
    </Modal>
  );
}
