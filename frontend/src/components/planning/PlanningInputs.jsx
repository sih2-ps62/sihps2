import { useState } from "react";
import { Check, Pencil, Plus } from "lucide-react";
import Button from "../ui/Button";
import Field, { inputClass } from "../ui/FormField";
import { api } from "../../lib/api";

const initial = {
  profile: { inventory_id: "", daily_min: "", daily_max: "", reserve: "", basis: "station", headcount: "", note: "" },
  arrival: { inventory_id: "", quantity: "", eta: "", asset_id: "", status: "expected", note: "" },
  link: { source_id: "", target_id: "", asset_id: "", travel_hours: "", capacity: "", mode: "surface", enabled: false, note: "" },
};

function InputEditor({ kind, record, context, onClose, onSaved }) {
  const [form, setForm] = useState(() => {
    const values = { ...initial[kind] };
    for (const key of Object.keys(values)) if (record?.[key] != null) values[key] = record[key];
    if (kind === "arrival" && values.eta) values.eta = values.eta.slice(0, 16);
    return values;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const update = (key, value) => setForm((old) => ({ ...old, [key]: value }));
  const stationNames = Object.fromEntries(context.stations.map((s) => [s.id, s.name]));
  const items = context.items.filter((i) => stationNames[i.station_id]);
  const itemSelect = (key, label) => <Field label={label}><select required className={inputClass} value={form[key]} disabled={kind === "profile" && Boolean(record)} onChange={(e) => update(key, e.target.value)}><option value="">Choose an item</option>{items.map((i) => <option key={i.id} value={i.id}>{i.name} · {stationNames[i.station_id]} ({i.unit})</option>)}</select></Field>;
  const number = (key, label, min = 0, required = true) => <Field label={label}><input required={required} type="number" step="any" min={min} className={inputClass} value={form[key]} onChange={(e) => update(key, e.target.value)} /></Field>;
  const transport = <Field label={kind === "arrival" ? "Transport asset (optional)" : "Approved transport asset"}><select required={kind === "link"} className={inputClass} value={form.asset_id} onChange={(e) => update("asset_id", e.target.value)}><option value="">{kind === "arrival" ? "External transport / not recorded" : "Choose a vehicle"}</option>{context.assets.filter((a) => a.category === "vehicle").map((a) => <option key={a.id} value={a.id}>{a.name} · {a.condition.replaceAll("_", " ")}</option>)}</select></Field>;

  async function save(event) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const body = { ...form };
      let path;
      if (kind === "profile") {
        path = `/planning/profiles/${form.inventory_id}`;
        delete body.inventory_id;
        for (const key of ["daily_min", "daily_max", "reserve"]) body[key] = Number(body[key]);
        body.headcount = body.basis === "person" && body.headcount !== "" ? Number(body.headcount) : null;
      } else if (kind === "arrival") {
        path = `/planning/arrivals${record?.id ? `/${record.id}` : ""}`;
        body.quantity = Number(body.quantity); body.asset_id = body.asset_id || null;
        body.eta = new Date(`${body.eta}:00Z`).toISOString();
      } else {
        path = `/planning/links${record?.id ? `/${record.id}` : ""}`;
        body.capacity = Number(body.capacity); body.travel_hours = Number(body.travel_hours);
      }
      await (kind !== "profile" && record?.id ? api.patch(path, body) : api.post(path, body));
      onSaved();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return <form onSubmit={save} className="glass-card p-5 sm:p-6" aria-label="Planning input editor">
    <h3 className="mb-4 font-semibold">{kind === "profile" ? "Consumption & reserve" : kind === "arrival" ? "External supply arrival" : "Approved supply link"}</h3>
    <div className="grid gap-4 sm:grid-cols-2">
      {kind !== "link" && itemSelect("inventory_id", "Inventory item")}
      {kind === "profile" && <>
        <Field label="Consumption basis"><select className={inputClass} value={form.basis} onChange={(e) => update("basis", e.target.value)}><option value="station">Per station, per day</option><option value="person">Per person, per day</option></select></Field>
        {number("daily_min", "Minimum daily use (item units)")}{number("daily_max", "Maximum daily use (item units)")}
        {number("reserve", "Protected reserve (item units)")}
        {form.basis === "person" && <Field label="Verified planning headcount"><input required type="number" min="1" max="10000" step="1" className={inputClass} value={form.headcount} onChange={(e) => update("headcount", e.target.value)} /></Field>}
      </>}
      {kind === "arrival" && <>
        {number("quantity", "Incoming quantity (item units)", 0.001)}
        <Field label="Expected arrival (UTC)"><input required type="datetime-local" className={inputClass} value={form.eta} onChange={(e) => update("eta", e.target.value)} /></Field>
        {transport}
        <Field label="Arrival status"><select className={inputClass} value={form.status} onChange={(e) => update("status", e.target.value)}><option value="expected">Expected</option><option value="received">Received</option><option value="cancelled">Cancelled</option></select></Field>
      </>}
      {kind === "link" && <>
        {itemSelect("source_id", "Source inventory")}{itemSelect("target_id", "Destination inventory")}{transport}
        <Field label="Transport mode"><select className={inputClass} value={form.mode} onChange={(e) => update("mode", e.target.value)}><option value="surface">Surface traverse</option><option value="air">Air</option><option value="sea">Sea</option></select></Field>
        {number("travel_hours", "Declared travel time (hours)", 0.001)}{number("capacity", "One-trip capacity (item units)", 0.001)}
      </>}
      <div className="sm:col-span-2"><Field label={kind === "link" ? "Approval reference & operating assumptions" : "Source & assumptions"}><textarea required minLength={12} maxLength={1000} rows={2} className={inputClass} value={form.note} onChange={(e) => update("note", e.target.value)} placeholder={kind === "profile" ? "Recorded usage, observation dates and occupancy assumptions…" : "Record where these planning inputs came from…"} /></Field></div>
      {kind === "link" && <label className="flex items-start gap-2 text-sm sm:col-span-2"><input type="checkbox" className="mt-1 accent-accent" checked={form.enabled} onChange={(e) => update("enabled", e.target.checked)} />This link is approved for planning with the stated mode, asset and capacity.</label>}
    </div>
    <p className="mt-4 text-xs text-text-secondary">{kind === "arrival" ? "Only record external supply that is not already counted in another station's stock. Received/cancelled arrivals leave the forecast; update actual stock separately in Inventory." : kind === "link" ? "Source and destination must have matching item names, categories and units. Saving a link records your approval reference; it does not certify terrain or operating conditions." : "Use a measured or explicitly estimated range. Headcount stays at your entered planning occupancy for this forecast."}</p>
    {error && <p role="alert" className="mt-3 text-sm text-status-critical">{error}</p>}
    <div className="mt-5 flex flex-wrap gap-2"><Button type="submit" icon={Check} disabled={busy}>{busy ? "Saving…" : "Save planning input"}</Button><Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button></div>
  </form>;
}

export default function PlanningInputs({ context, training, onSaved }) {
  const [editor, setEditor] = useState(null);
  const names = Object.fromEntries(context.stations.map((s) => [s.id, s.name]));
  const itemName = (id) => { const i = context.items.find((item) => item.id === id); return i ? `${i.name} · ${names[i.station_id] || "Unassigned"}` : "Item no longer exists"; };
  return <div className="space-y-5">
    <div className="glass-card p-5"><h2 className="font-semibold">Make the assumptions visible.</h2><p className="mt-1 text-sm text-text-secondary">Configure consumption, incoming external supply and approved transfer links. Forecasts use current Inventory quantities. {training && "Training inputs are fictional and read-only; switch to Operations to configure your stations."}</p></div>
    {editor && <InputEditor key={`${editor.kind}-${editor.record?.id || editor.record?.inventory_id || "new"}`} {...editor} context={context} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); onSaved(); }} />}
    <section className="glass-card overflow-hidden p-5">
      <h3 className="mb-4 font-semibold">Consumption & reserves <span className="ml-2 text-xs font-normal text-text-secondary">{context.items.filter((i) => i.profile).length}/{context.items.length} configured</span></h3>
      <div className="divide-y divide-border">{context.items.map((i) => <div key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="text-sm font-medium">{itemName(i.id)}</p><p className="text-xs text-text-secondary">{i.profile ? `${i.profile.daily_min}–${i.profile.daily_max} ${i.unit} / ${i.profile.basis === "person" ? `person / day × ${i.profile.headcount} people` : "day"} · reserve ${i.profile.reserve} ${i.unit}` : "Consumption not recorded"}</p></div>{!training && i.station_id && <Button variant="ghost" icon={Pencil} onClick={() => setEditor({ kind: "profile", record: { ...i.profile, inventory_id: i.id } })}>Configure</Button>}</div>)}</div>
      {!context.items.length && <p className="text-sm text-text-secondary">Add station inventory first.</p>}
    </section>
    {[{ kind: "arrival", title: "External arrivals", rows: context.arrivals }, { kind: "link", title: "Approved supply links", rows: context.links }].map(({ kind, title, rows }) => <section key={kind} className="glass-card p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">{title}</h3>{!training && <Button variant="ghost" icon={Plus} onClick={() => setEditor({ kind, record: null })}>{kind === "arrival" ? "Add arrival" : "Add supply link"}</Button>}</div>
      <div className="divide-y divide-border">{rows.map((r) => <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0 flex-1"><p className="text-sm font-medium">{kind === "arrival" ? itemName(r.inventory_id) : `${itemName(r.source_id)} → ${itemName(r.target_id)}`}</p><p className="mt-1 text-xs text-text-secondary">{kind === "arrival" ? `${r.quantity} incoming · ${r.eta.replace("T", " ").replace("Z", " UTC")} · ${r.status}` : `${r.travel_hours}h travel · ${r.capacity} unit capacity · ${r.enabled ? "Approved" : "Disabled"}`}</p></div>{!training && <Button variant="ghost" icon={Pencil} onClick={() => setEditor({ kind, record: r })}>Edit</Button>}</div>)}</div>
      {!rows.length && <p className="py-3 text-sm text-text-secondary">{kind === "arrival" ? "No external arrivals recorded. Forecasts will use current stock only." : "No approved links. Add one to assess a stock transfer between stations."}</p>}
    </section>)}
  </div>;
}
