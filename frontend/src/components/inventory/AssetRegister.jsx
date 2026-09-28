import { useState } from "react";
import { Wrench, Plus } from "lucide-react";
import { useQuery } from "../../hooks/useApi";
import { api } from "../../lib/api";
import Button from "../ui/Button";
import Field, { inputClass } from "../ui/FormField";
import StatusBadge from "../ui/StatusBadge";

export default function AssetRegister() {
  const { data, error, refetch } = useQuery(() => api.get("/assets"), []);
  const { data: stations } = useQuery(() => api.get("/stations"), []);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", category: "medical", current_holder_id: "" });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const mutate = async (fn) => {
    setBusy(true); setActionError("");
    try { await fn(); refetch(); }
    catch (err) { setActionError(err.message); }
    finally { setBusy(false); }
  };
  return <section className="glass-card space-y-4 p-5" aria-label="Asset register">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 text-lg font-semibold"><Wrench size={19} className="text-accent" /> Asset readiness</h2>
      <p className="mt-1 text-sm text-text-secondary">Vehicles, medical kits and field equipment. Condition changes feed the departure gate.</p></div>
      <Button variant="ghost" icon={Plus} onClick={() => setAdding(!adding)}>Register asset</Button></div>
    {adding && <form className="space-y-3 rounded-xl border border-border p-4" onSubmit={(e) => { e.preventDefault(); mutate(async () => {
      await api.post("/assets", { ...form, current_holder_type: "station", condition: "operational" });
      setAdding(false); setForm({ name: "", category: "medical", current_holder_id: "" });
    }); }}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Asset name"><input required className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Field emergency kit" /></Field>
        <Field label="Category"><select className={inputClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{["medical", "vehicle", "comms", "shelter", "power"].map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Holding station"><select required className={inputClass} value={form.current_holder_id} onChange={(e) => setForm({ ...form, current_holder_id: e.target.value })}><option value="">Select station</option>{(stations?.data || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
      </div><Button type="submit" disabled={busy}>Save asset</Button>
    </form>}
    {(error || actionError) && <p role="alert" className="text-sm text-status-critical">{error?.message || actionError}</p>}
    <div className="max-h-80 space-y-2 overflow-y-auto pr-1">{(data?.data || []).map((a) => <div key={a.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3">
      <div className="min-w-40 flex-1"><p className="text-sm font-medium">{a.name}</p><p className="text-xs text-text-secondary">{a.id} · {a.category} · {a.holder_id}{a.reserved_by.length ? ` · Incident: ${a.reserved_by.join(", ")}` : ""}</p></div>
      <StatusBadge label={a.condition.replaceAll("_", " ")} tone={a.condition === "operational" ? "ok" : "warning"} />
      <select className={`${inputClass} !w-auto !py-1.5 !text-xs`} value={a.condition} aria-label={`Condition of ${a.name}`} disabled={busy}
        onChange={(e) => mutate(() => api.patch(`/assets/${a.id}`, { condition: e.target.value }))}>
        <option value="operational">Operational</option><option value="needs_maintenance">Needs maintenance</option><option value="retired">Retired</option>
      </select>
    </div>)}</div>
  </section>;
}
