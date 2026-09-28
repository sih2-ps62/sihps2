import { useState } from "react";
import { CheckCircle2, CircleAlert, RefreshCw, Rocket, ShieldCheck, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useQuery } from "../../hooks/useApi";
import { useToast } from "../../context/ToastContext";
import Button from "../ui/Button";
import Field, { inputClass } from "../ui/FormField";
import RouteDeviations from "../safety/RouteDeviations";

function toggle(items, id) { return items.includes(id) ? items.filter((item) => item !== id) : [...items, id]; }

export default function ExpeditionSafetyPanel({ expedition, onChange }) {
  const { showToast } = useToast();
  const { data: people, refetch: refreshPeople, error: peopleError } = useQuery(() => api.get("/personnel", { pageSize: 100 }), []);
  const { data: assets, refetch: refreshAssets, error: assetsError } = useQuery(() => api.get("/assets"), []);
  const [crewIds, setCrewIds] = useState(expedition.personnel_ids || []);
  const [assetIds, setAssetIds] = useState(expedition.asset_ids || []);
  const [kit, setKit] = useState(expedition.emergency_kit_id || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const refresh = () => { onChange(); refreshPeople(); refreshAssets(); };
  const action = async (work, message) => {
    setBusy(true); setError("");
    try { await work(); showToast(message); refresh(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const gate = expedition.departure_gate;
  const dirty = JSON.stringify([...crewIds].sort()) !== JSON.stringify([...(expedition.personnel_ids || [])].sort()) ||
    JSON.stringify([...assetIds].sort()) !== JSON.stringify([...(expedition.asset_ids || [])].sort()) || kit !== (expedition.emergency_kit_id || "");
  const nextStep = expedition.route_steps?.find((w) => w.status === "pending");
  const completed = expedition.status === "Completed";

  return <section className="space-y-5 border-t border-border pt-5" aria-label="Expedition safety controls">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="flex items-center gap-2 text-lg font-semibold"><ShieldCheck size={20} className="text-accent" /> Departure control</h2>
        <p className="mt-1 text-sm text-text-secondary">Every launch is checked against the live crew and manifest.</p></div>
      <Button variant="ghost" icon={RefreshCw} onClick={refresh} disabled={busy || dirty}>Recheck</Button>
    </div>
    {gate && <div className={`rounded-2xl border p-4 ${gate.can_launch ? "border-status-ok/30 bg-status-ok/5" : "border-status-warning/30 bg-status-warning/5"}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div><p className={`text-sm font-bold tracking-wide ${gate.can_launch ? "text-status-ok" : "text-status-warning"}`}>
          {expedition.status === "Active" ? "LIVE SAFETY CHECK" : completed ? "CURRENT READINESS" : gate.can_launch ? "GO · READY TO DEPART" : "NO-GO · ACTION REQUIRED"}</p>
          <p className="mt-1 text-xs text-text-secondary">{gate.active_crew_count} active crew · Check-ins within {gate.checkin_window_hours} hours</p></div>
        {!completed && expedition.status !== "Active" && <Button icon={Rocket} disabled={busy || dirty || !gate.can_launch}
          onClick={() => action(() => api.patch(`/expeditions/${expedition.id}`, { status: "Active" }), "Expedition launched. All departure checks passed.")}>Launch expedition</Button>}
        {expedition.status === "Active" && <Button variant="ghost" disabled={busy} onClick={() => action(() => api.patch(`/expeditions/${expedition.id}`, { status: "Completed" }), "Expedition completed.")}>Complete expedition</Button>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {gate.checks.map((check) => { const Icon = check.passed ? CheckCircle2 : CircleAlert; return <div key={check.key} className="flex gap-2.5">
          <Icon size={17} className={`mt-0.5 shrink-0 ${check.passed ? "text-status-ok" : "text-status-warning"}`} />
          <div><p className="text-sm font-medium">{check.label}</p><p className="mt-0.5 text-xs text-text-secondary">{check.detail}</p></div>
        </div>; })}
      </div>
    </div>}
    {!completed && <details className="rounded-xl border border-border p-4" open={expedition.status === "Planned"}>
      <summary className="focus-ring text-sm font-semibold">Crew & equipment manifest</summary>
      <p className="my-3 text-xs text-text-secondary">Select personnel, assign equipment and explicitly designate a medical asset as the emergency kit. Save before launching.</p>
      {(peopleError || assetsError) && <p role="alert" className="text-sm text-status-critical">{peopleError?.message || assetsError?.message}</p>}
      <div className="grid gap-5 lg:grid-cols-2">
        <fieldset><legend className="mb-2 flex items-center gap-2 text-xs font-semibold text-text-secondary"><Users size={14} /> Assigned personnel</legend>
          <div className="max-h-64 space-y-2 overflow-y-auto pr-2">
            {(people?.data || []).map((p) => <div key={p.id} className="rounded-lg border border-border p-2.5">
              <label className="flex gap-2.5 text-sm"><input type="checkbox" className="accent-accent" disabled={busy} checked={crewIds.includes(p.id)} onChange={() => setCrewIds(toggle(crewIds, p.id))} />
                <span>{p.name}<span className="mt-0.5 block text-xs text-text-secondary">{p.role} · {p.operational_status?.replaceAll("_", " ") || p.status}</span></span></label>
              {crewIds.includes(p.id) && <div className="mt-2 flex flex-wrap gap-3 pl-6 text-xs">
                <Link className="focus-ring rounded text-accent hover:underline" to={`/personnel/${p.id}`}>Personnel record</Link>
                <button type="button" disabled={busy} className="focus-ring rounded text-accent disabled:opacity-50" onClick={() => action(async () => {
                  await api.patch(`/personnel/${p.id}`, { status: "In Field" });
                  const response = await api.post(`/personnel/${p.id}/checkin`);
                  if (response?.queued) throw new Error("Check-in queued. Restore connectivity before launching.");
                }, "Personnel confirmed active and checked in.")}>Confirm active & check in</button>
              </div>}
            </div>)}
          </div>
        </fieldset>
        <fieldset><legend className="mb-2 text-xs font-semibold text-text-secondary">Assigned assets</legend>
          <div className="max-h-48 space-y-2 overflow-y-auto pr-2">
            {(assets?.data || []).map((a) => { const unavailable = (a.holder_type === "expedition" && a.holder_id !== expedition.id) || (a.condition !== "operational" && !assetIds.includes(a.id)); return <label key={a.id} className={`flex gap-2.5 rounded-lg border border-border p-2.5 text-sm ${unavailable ? "opacity-50" : ""}`}>
              <input type="checkbox" disabled={busy || unavailable} checked={assetIds.includes(a.id)} onChange={() => { setAssetIds(toggle(assetIds, a.id)); if (kit === a.id) setKit(""); }} />
              <span>{a.name}<span className="mt-0.5 block text-xs text-text-secondary">{a.condition.replaceAll("_", " ")} · {a.holder_id}</span></span>
            </label>; })}
          </div>
          <div className="mt-3"><Field label="Emergency kit on manifest"><select className={inputClass} value={kit} disabled={busy} onChange={(e) => setKit(e.target.value)}>
            <option value="">Choose an assigned medical kit</option>
            {(assets?.data || []).filter((a) => assetIds.includes(a.id) && a.category === "medical").map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select></Field></div>
        </fieldset>
      </div>
      <Button className="mt-4" disabled={busy || !dirty} onClick={() => action(() => api.patch(`/expeditions/${expedition.id}`,
        { personnel_ids: crewIds, asset_ids: assetIds, emergency_kit_id: kit || null }), "Manifest saved. Departure checks refreshed.")}>{busy ? "Saving…" : "Save manifest"}</Button>
      {dirty && <p className="mt-2 text-xs text-status-warning">Unsaved changes. The gate above reflects the saved manifest.</p>}
    </details>}
    {error && <p role="alert" className="rounded-xl border border-status-critical/30 bg-status-critical/5 p-3 text-sm text-status-critical">{error}</p>}
    <div><h3 className="mb-3 text-sm font-semibold">Waypoint progress</h3><div className="space-y-2">
      {(expedition.route_steps || []).map((step) => <div key={step.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3">
        <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${step.status === "reached" ? "bg-status-ok/10 text-status-ok" : "bg-accent-soft text-accent"}`}>{step.status === "reached" ? "✓" : step.sequence}</span>
        <span className="flex-1 text-sm">{step.station_name}</span>
        {step.status === "reached" ? <span className="text-xs text-status-ok">Reached</span> : <Button variant="ghost" className="!py-1.5 !text-xs"
          disabled={busy || dirty || expedition.status !== "Active" || gate?.active_crew_count < 2 || nextStep?.id !== step.id}
          onClick={() => action(() => api.post(`/expeditions/${expedition.id}/waypoints/${step.id}/reach`), "Waypoint reached. Buddy rule verified.")}>Mark reached</Button>}
      </div>)}
      {!expedition.route_steps?.length && <p className="text-sm text-text-secondary">No route planned.</p>}
    </div></div>
    <RouteDeviations events={expedition.route_deviations || []} onReviewed={refresh} />
    {!!expedition.checkins?.length && <div><h3 className="mb-2 text-sm font-semibold">Recent route check-ins</h3>
      <p className="mb-3 text-xs text-text-secondary">Compared with the next pending waypoint at check-in time. Station reports, without live GPS.</p>
      <div className="space-y-2">{expedition.checkins.slice(0, 6).map((e) => <p key={e.id} className="rounded-lg border border-border p-2.5 text-xs text-text-secondary">
        <span className="font-medium text-text-primary">{e.personnel_name}</span> · {e.station_name || "Location unreported"} · <span className={e.outcome === "deviation" ? "text-status-warning" : ""}>{e.outcome.replaceAll("_", " ")}</span> · {new Date(e.timestamp).toLocaleString()}
      </p>)}</div>
    </div>}
  </section>;
}
