import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Ambulance, ShieldAlert } from "lucide-react";
import DetailShell from "../components/ui/DetailShell";
import Button from "../components/ui/Button";
import StatusBadge from "../components/ui/StatusBadge";
import MedicalQuickCard from "../components/safety/MedicalQuickCard";
import { useQuery } from "../hooks/useApi";
import { api } from "../lib/api";
import { useToast } from "../context/ToastContext";

const toggle = (list, id) => list.includes(id) ? list.filter((v) => v !== id) : [...list, id];
export default function EmergencyDetail() {
  const { id } = useParams();
  const { showToast } = useToast();
  const { data, error, refetch } = useQuery(() => api.get(`/emergencies/${id}`), [id]);
  const { data: assets, error: assetsError, refetch: refreshAssets } = useQuery(() => api.get("/assets"), []);
  const { data: people, error: peopleError } = useQuery(() => api.get("/personnel", { pageSize: 100 }), []);
  const { data: openIncidents, error: incidentsError, refetch: refreshIncidents } = useQuery(() => api.get("/emergencies", { status: "Open", pageSize: 100 }), []);
  const [assetIds, setAssetIds] = useState([]);
  const [responderIds, setResponderIds] = useState([]);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const incident = data?.data;
  useEffect(() => { if (incident) { setAssetIds(incident.asset_ids); setResponderIds(incident.responder_ids); } }, [incident]);
  const action = async (body, message) => {
    setBusy(true); setActionError("");
    try { await api.patch(`/emergencies/${id}`, body); showToast(message); refetch(); refreshAssets(); refreshIncidents(); }
    catch (err) { setActionError(err.message); refreshAssets(); refreshIncidents(); }
    finally { setBusy(false); }
  };
  if (!incident) return <DetailShell backTo="/emergency" backLabel="Back to Emergency" title={error ? "Incident unavailable" : "Loading incident…"}>
    {error && <p role="alert" className="text-status-critical">{error.message}</p>}
  </DetailShell>;
  const reservations = (kind, rid) => (openIncidents?.data || []).filter((i) => i.id !== id && (kind === "asset" ? i.asset_ids : i.responder_ids)?.includes(rid)).map((i) => i.id);
  const proposedConflicts = [...assetIds.map((rid) => ({ kind: "asset", rid })), ...responderIds.map((rid) => ({ kind: "personnel", rid }))]
    .map((r) => ({ ...r, incidents: reservations(r.kind, r.rid) })).filter((r) => r.incidents.length);
  const resolved = incident.status === "Resolved";
  return <DetailShell backTo="/emergency" backLabel="Back to Emergency" title={incident.title} subtitle={`${incident.id} · ${incident.station_name || "No station"}`}
    action={<StatusBadge label={incident.response_status} tone={resolved ? "ok" : "critical"} />}>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4">
      <div><p className="text-xs text-text-secondary">Affected person</p>{incident.personnel_id ? <Link className="text-sm font-semibold text-accent" to={`/personnel/${incident.personnel_id}`}>{incident.personnel_name}</Link> : <p className="text-sm">Station-level incident</p>}</div>
      {!resolved && <div className="flex flex-wrap gap-2">{incident.response_status === "open" && <Button variant="ghost" icon={Ambulance} disabled={busy} onClick={() => action({ status: "Responding" }, "Response started.")}>Start response</Button>}
        <Button variant="ghost" disabled={busy} onClick={() => action({ status: "Resolved" }, "Incident resolved. Resources released.")}>Resolve incident</Button></div>}
    </div>
    {incident.personnel_id && !resolved && <MedicalQuickCard key={id} kind="incident" recordId={id} />}
    {incident.escalated_at && <p className="text-sm text-status-warning">Escalated automatically at {incident.escalated_at} UTC.</p>}
    <section className="space-y-4 border-t border-border pt-5">
      <div><h2 className="flex items-center gap-2 text-lg font-semibold"><ShieldAlert size={20} className="text-accent" /> Response resources</h2>
        <p className="mt-1 text-sm text-text-secondary">Assets and responders are reserved across every open incident. Double assignment is blocked.</p></div>
      {resolved && <p className="text-sm text-status-ok">Resolved. Previous assignments are retained here as history and no longer reserve resources.</p>}
      {!!proposedConflicts.length && !resolved && <div role="alert" className="rounded-xl border border-status-critical/30 bg-status-critical/5 p-3 text-sm text-status-critical">
        <p className="font-semibold">Resource conflict — assignment blocked</p>
        {proposedConflicts.map((c) => <p key={c.rid}>{(c.kind === "asset" ? assets?.data : people?.data)?.find((r) => r.id === c.rid)?.name || c.rid} is already reserved for {c.incidents.join(", ")}.</p>)}
      </div>}
      <div className="grid gap-5 sm:grid-cols-2">
        {[ ["Assets", assets?.data || [], assetIds, setAssetIds, "asset"], ["Responders", (people?.data || []).filter((p) => p.id !== incident.personnel_id), responderIds, setResponderIds, "personnel"] ].map(([label, rows, selected, setSelected, kind]) =>
          <fieldset key={label} disabled={busy || resolved}><legend className="mb-2 text-sm font-semibold">{label}</legend><div className="max-h-72 space-y-2 overflow-y-auto pr-2">
            {rows.map((r) => { const used = reservations(kind, r.id); const unavailable = kind === "asset" ? r.condition !== "operational" : ["on_leave", "emergency", "overdue"].includes(r.operational_status); return <label key={r.id} className="flex gap-2.5 rounded-xl border border-border p-3 text-sm">
              <input type="checkbox" checked={selected.includes(r.id)} disabled={unavailable && !selected.includes(r.id)} onChange={() => setSelected(toggle(selected, r.id))} />
              <span>{r.name}<span className={`mt-1 block text-xs ${used.length ? "text-status-warning" : "text-text-secondary"}`}>{used.length ? `Reserved: ${used.join(", ")}` : kind === "asset" ? r.condition.replaceAll("_", " ") : `${r.role} · ${r.operational_status?.replaceAll("_", " ") || r.status}`}</span></span>
            </label>; })}
          </div></fieldset>)}
      </div>
      {(assetsError || peopleError || incidentsError) && <p role="alert" className="text-sm text-status-critical">{assetsError?.message || peopleError?.message || incidentsError?.message}</p>}
      {!resolved && <Button disabled={busy || proposedConflicts.length > 0 || !assets || !people || !openIncidents} onClick={() => action({ asset_ids: assetIds, responder_ids: responderIds }, "Response resources assigned.")}>{busy ? "Saving…" : "Assign response resources"}</Button>}
      {actionError && <p role="alert" className="rounded-xl border border-status-critical/30 p-3 text-sm text-status-critical">{actionError}</p>}
    </section>
  </DetailShell>;
}
