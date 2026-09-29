import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Clock3, FlaskConical, GitBranch, Layers3, RefreshCw, ShieldCheck, SlidersHorizontal, Snowflake, TriangleAlert } from "lucide-react";
import Button from "../components/ui/Button";
import Field, { inputClass } from "../components/ui/FormField";
import ForecastChart from "../components/planning/ForecastChart";
import { days } from "../lib/planning";
import PlanningInputs from "../components/planning/PlanningInputs";
import PlanningDrafts from "../components/planning/PlanningDrafts";
import { useQuery } from "../hooks/useApi";
import { api } from "../lib/api";
import { useToast } from "../context/ToastContext";
import "./mission-planner.css";

const emptyScenario = { horizon_days: 14, delay_hours: 0, delay_station_id: null, closed_link_id: null, unavailable_asset_id: null, unavailable_person_id: null };

function DraftForm({ result, option, onSaved, disabled }) {
  const [title, setTitle] = useState(option.title);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await api.post("/planning/drafts", { training: result.training, scenario: result.scenario, as_of: result.as_of,
        fingerprint: result.fingerprint, option_id: option.id, title, reason });
      onSaved();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="mt-5 rounded-xl border border-accent/40 bg-accent-soft/40 p-4" aria-label="Create recovery draft">
    <p className="mb-3 text-sm font-semibold">Record your decision for review</p>
    <div className="space-y-3"><Field label="Draft title"><input required minLength={3} maxLength={140} className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} /></Field><Field label="Reason for this recovery plan"><textarea required minLength={12} maxLength={1500} rows={2} className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why this option, and what needs verification before action?" /></Field></div>
    {error && <p className="mt-3 text-sm text-status-critical" role="alert">{error}</p>}
    <div className="mt-4 flex flex-wrap items-center gap-3"><Button icon={Check} type="submit" disabled={busy || disabled}>{busy ? "Saving…" : "Save recovery draft"}</Button><span className="text-xs text-text-secondary">Saves a proposal for review.</span></div>
  </form>;
}

function PlannerWorkspace({ training, switchMode }) {
  const { showToast } = useToast();
  const [tab, setTab] = useState("lab");
  const [revision, setRevision] = useState(0);
  const [scenario, setScenario] = useState({ ...emptyScenario, delay_hours: training ? 72 : 0 });
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const inputKey = JSON.stringify(scenario);
  const contextQuery = useQuery(() => api.get("/planning/context", { training }), [training, revision]);
  const forecastQuery = useQuery(() => api.post("/planning/simulate", { training, scenario }).then((response) => ({ ...response.data, inputKey })), [training, inputKey, revision]);
  const result = forecastQuery.data;
  const context = contextQuery.data?.data;
  const updating = forecastQuery.isLoading || result?.inputKey !== inputKey || Boolean(forecastQuery.error);
  const stations = Object.fromEntries((context?.stations || []).map((s) => [s.id, s.name]));
  const current = result?.forecast.find((f) => f.id === selectedItem) || result?.forecast.find((f) => f.status !== "unknown") || result?.forecast[0];
  const baseline = result?.baseline.find((f) => f.id === current?.id);
  const option = !updating ? result?.recoveries.find((r) => r.id === selectedOption) : null;
  const chartRecovery = option?.kind === "transfer" && option.target_id === current?.id ? option : null;
  const refresh = () => { setSelectedOption(null); setRevision((v) => v + 1); };
  function updateScenario(key, value) { setSelectedOption(null); setScenario((previous) => ({ ...previous, [key]: value })); }
  function preset(values) { setSelectedOption(null); setScenario({ ...emptyScenario, ...values }); }
  const selectedItemName = (id) => {
    const item = context?.items.find((i) => i.id === id);
    return item ? stations[item.station_id] || "Unassigned station" : "Missing item";
  };
  const select = (label, key, rows, placeholder) => <Field label={label}><select className={inputClass} value={scenario[key] || ""} onChange={(e) => updateScenario(key, e.target.value || null)}><option value="">{placeholder}</option>{rows.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field>;

  return <div className="planner-page space-y-5 px-4 py-5 sm:px-6 md:px-8">
    <section className="planner-hero glass-card relative overflow-hidden p-6 sm:p-8">
      <div className="planner-orbits" aria-hidden="true"><i /><i /><i /></div>
      <div className="relative flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-xl"><p className="planner-eyebrow flex items-center gap-2"><GitBranch size={14} /> PolarOps · Mission planning</p><h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Plan for the <span className="text-accent">unexpected.</span></h1><p className="mt-3 max-w-lg text-sm leading-relaxed text-text-secondary">Explore supply endurance, test a disruption and compare the options available to your team.</p></div>
        <div className="inline-flex rounded-xl border border-border bg-surface-solid p-1" aria-label="Planner data source">{[false, true].map((mode) => <button key={String(mode)} onClick={() => switchMode(mode)} aria-pressed={training === mode} className={`focus-ring flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${training === mode ? "bg-accent text-white" : "text-text-secondary hover:text-text-primary"}`}>{mode ? <FlaskConical size={14} /> : <Layers3 size={14} />}{mode ? "Training" : "Operations"}</button>)}</div>
      </div>
      <div className="relative mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-4 text-xs text-text-secondary"><span className="flex items-center gap-2"><span className={`h-1.5 w-1.5 rounded-full ${training ? "bg-status-warning" : "bg-accent"}`} />{training ? "Fictional exercise · isolated from operations" : "Current inventory · recorded planning assumptions"}</span><span className="flex items-center gap-1.5"><ShieldCheck size={13} /> Officer-reviewed draft plans</span></div>
    </section>

    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-surface p-1" role="tablist" aria-label="Planner sections">{[["lab", "Scenario lab"], ["inputs", "Planning inputs"], ["drafts", "Saved drafts"]].map(([id, label]) => <button key={id} role="tab" id={`planning-tab-${id}`} aria-controls={`planning-panel-${id}`} aria-selected={tab === id} onClick={() => setTab(id)} className={`focus-ring rounded-lg px-3 py-2 text-sm transition-colors ${tab === id ? "bg-surface-solid font-semibold text-text-primary shadow-sm" : "text-text-secondary hover:text-text-primary"}`}>{label}</button>)}</div>
      <button onClick={refresh} className="focus-ring flex items-center gap-2 rounded-lg p-2 text-xs text-text-secondary hover:text-accent" disabled={forecastQuery.isLoading}><RefreshCw size={13} className={forecastQuery.isLoading ? "animate-spin" : ""} />Refresh inputs</button>
    </div>
    {(contextQuery.error || forecastQuery.error) && <div className="rounded-xl border border-status-critical/30 bg-status-critical/5 p-4 text-sm text-status-critical" role="alert">{contextQuery.error?.message || forecastQuery.error?.message}<button onClick={refresh} className="ml-3 font-semibold underline">Retry</button></div>}
    {!context && contextQuery.isLoading && <div role="status" className="glass-card p-8 text-sm text-text-secondary">Loading planning inputs…</div>}

    {tab === "inputs" && context && <div role="tabpanel" id="planning-panel-inputs" aria-labelledby="planning-tab-inputs"><PlanningInputs context={context} training={training} onSaved={() => { showToast("Planning inputs saved. Forecast refreshed."); refresh(); }} /></div>}
    {tab === "drafts" && <div role="tabpanel" id="planning-panel-drafts" aria-labelledby="planning-tab-drafts"><PlanningDrafts revision={revision} /></div>}
    {tab === "lab" && context && <div role="tabpanel" id="planning-panel-lab" aria-labelledby="planning-tab-lab" className="space-y-5">
      {!training && !context.items.some((i) => i.profile) && <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-accent/30 bg-accent-soft/70 p-5"><div><h2 className="font-semibold">Start with a few known quantities.</h2><p className="mt-1 text-sm text-text-secondary">Add consumption and reserves to forecast your stations, or explore the prepared training exercise.</p></div><div className="flex flex-wrap gap-2"><Button variant="ghost" onClick={() => setTab("inputs")}>Configure inputs</Button><Button icon={FlaskConical} onClick={() => switchMode(true)}>Try training scenario</Button></div></div>}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Scenario summary">
        {[
          { label: "Stations reaching reserve", value: result?.summary.at_risk, icon: TriangleAlert, tone: "text-status-warning", detail: `Within ${scenario.horizon_days} days` },
          { label: "Missions to review", value: result?.summary.affected_missions, icon: GitBranch, tone: "text-accent", detail: "Supply or resource dependencies" },
          { label: "Transfer options", value: result?.summary.transfer_options, icon: ArrowRight, tone: "text-status-ok", detail: "Within recorded constraints" },
          { label: "Items missing inputs", value: result?.summary.unknown_items, icon: SlidersHorizontal, tone: "text-text-secondary", detail: "Cannot assess endurance" },
        ].map(({ label, value, icon: Icon, tone, detail }) => <div key={label} className="glass-card p-4 sm:p-5"><div className="flex items-center justify-between gap-2"><p className="text-xs text-text-secondary">{label}</p><Icon size={15} className={`shrink-0 ${tone}`} /></div><p className={`mt-3 text-3xl font-semibold tabular-nums ${tone}`}>{updating ? "—" : value ?? "—"}</p><p className="mt-2 text-xs text-text-secondary">{detail}</p></div>)}
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
        <section className="glass-card p-5" aria-label="Scenario controls">
          <p className="planner-eyebrow">01 · Set the conditions</p><h2 className="mt-2 text-lg font-semibold">What changes?</h2>
          <div className="mt-5 space-y-5">
            <Field label="Planning horizon"><select className={inputClass} value={scenario.horizon_days} onChange={(e) => updateScenario("horizon_days", Number(e.target.value))}>{[7, 14, 30].map((v) => <option key={v} value={v}>{v} days ahead</option>)}</select></Field>
            <div className="rounded-xl border border-accent/20 bg-accent-soft/50 p-4"><div className="flex items-center justify-between"><label htmlFor="delay-hours" className="text-xs font-medium">Supply delay</label><output htmlFor="delay-hours" className="text-lg font-semibold tabular-nums text-accent">{scenario.delay_hours}h</output></div><input id="delay-hours" aria-label="Supply delay hours" type="range" min="0" max="168" step="6" value={scenario.delay_hours} onChange={(e) => updateScenario("delay_hours", Number(e.target.value))} className="planner-slider mt-4 w-full" style={{ "--range-fill": `${scenario.delay_hours / 168 * 100}%` }} /><div className="mt-2 flex justify-between text-[10px] text-text-secondary"><span>On time</span><span>7 days late</span></div></div>
            {select("Delay applies to", "delay_station_id", context.stations, "All destinations")}
            {select("Close a supply link", "closed_link_id", context.links.map((l) => ({ id: l.id, name: `${selectedItemName(l.source_id)} → ${selectedItemName(l.target_id)}` })), "Keep links available")}
            {select("Make an asset unavailable", "unavailable_asset_id", context.assets, "No simulated failure")}
            {select("Make a person unavailable", "unavailable_person_id", context.people, "No additional commitment")}
          </div>
          {training && <div className="mt-5 border-t border-border pt-4"><p className="mb-2 text-xs text-text-secondary">Exercise presets</p><div className="flex flex-wrap gap-2">{[["72h delay", { delay_hours: 72 }], ["Route closure", { delay_hours: 72, closed_link_id: "link-1" }], ["Vehicle failure", { delay_hours: 72, unavailable_asset_id: "snow-1" }]].map(([label, values]) => <button key={label} onClick={() => preset(values)} className="focus-ring rounded-lg border border-border px-2 py-1.5 text-xs hover:bg-accent-soft">{label}</button>)}</div></div>}
          <button onClick={() => preset({})} className="focus-ring mt-5 rounded text-xs font-medium text-text-secondary underline underline-offset-4">Reset to baseline</button>
          <p className="mt-4 text-xs leading-relaxed text-text-secondary">Delay affects external arrivals and proposed transfers to the selected destinations. Closures and resource failures last for this scenario’s horizon.</p>
        </section>

        <div className="min-w-0 space-y-5">
          <section className={`glass-card p-5 sm:p-6 ${updating ? "planner-updating" : ""}`} aria-label="Endurance forecast" aria-busy={updating}>
            <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="planner-eyebrow">02 · Follow the impact</p><h2 className="mt-2 text-lg font-semibold">Supply endurance</h2></div><div className="w-full sm:w-auto sm:max-w-[260px]"><Field label="Supply to inspect"><select className={inputClass} value={current?.id || ""} onChange={(e) => { setSelectedItem(e.target.value); setSelectedOption(null); }}>{result?.forecast.map((f) => <option key={f.id} value={f.id}>{f.name} · {stations[f.station_id] || "Unassigned"}</option>)}</select></Field></div></div>
            <div className="mb-2 mt-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs text-text-secondary">Earliest projected reserve</p><p className={`mt-1 text-2xl font-semibold tabular-nums ${current?.reserve_days_min != null ? "text-status-warning" : "text-text-primary"}`}>{updating ? "Recalculating…" : current?.status === "unknown" ? "Cannot assess" : current ? days(current.reserve_days_min, scenario.horizon_days) : "No inventory recorded"}</p>{!updating && current?.status !== "unknown" && current?.reserve_days_min != null && <p className="mt-1 text-xs text-text-secondary">Lower-use estimate: {days(current.reserve_days_max, scenario.horizon_days)}</p>}</div><p className="text-xs text-text-secondary">{updating ? "Updating comparison" : result ? `As of ${new Date(result.as_of).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Loading forecast"}</p></div>
            <ForecastChart current={current} baseline={baseline} recovery={chartRecovery} horizon={scenario.horizon_days} />
            {current?.profile && <details className="mt-4 rounded-xl border border-border p-3"><summary className="focus-ring text-xs font-medium">Calculation & source assumptions</summary><div className="mt-3 space-y-2 text-xs text-text-secondary"><p>{current.quantity} {current.unit} on hand − {current.daily_min}–{current.daily_max} {current.unit}/day, plus eligible expected arrivals. Protected reserve: {current.reserve} {current.unit}.</p>{current.profile.basis === "person" && <p>Verified planning occupancy: {current.profile.headcount} people, held constant for this forecast.</p>}<p>{current.profile.note}</p><p>Assumptions updated: {new Date(current.profile.updated_at).toLocaleString()}</p><p>Arrival ETAs are conditional. Weather, terrain, future occupancy changes and unrecorded supply needs require officer review.</p></div></details>}
            {current?.warnings?.map((warning) => <p key={warning} className="mt-3 text-xs text-status-warning">{warning}</p>)}
          </section>

          <section className="glass-card p-5 sm:p-6" aria-label="Impact timeline"><div className="mb-4 flex items-center gap-2"><Clock3 size={16} className="text-accent" /><h2 className="text-sm font-semibold">The next {scenario.horizon_days} days</h2></div>
            {current?.status !== "unknown" && current && <div className="planner-timeline" style={{ "--horizon": scenario.horizon_days }}><span className="planner-timeline-line" /><div className="flex justify-between pb-7 text-[10px] text-text-secondary"><span>Now</span><span>Day {scenario.horizon_days}</span></div>{current.reserve_days_min != null && <div className="planner-marker bg-status-warning" style={{ left: `${Math.max(1, Math.min(98, current.reserve_days_min / scenario.horizon_days * 100))}%` }} title={`Reserve reached on day ${current.reserve_days_min}`} />}{current.arrivals.filter((a) => !a.excluded_reason && a.day > 0 && a.day <= scenario.horizon_days).map((a) => <div key={a.id} className="planner-marker bg-accent" style={{ left: `${Math.max(1, Math.min(98, a.day / scenario.horizon_days * 100))}%` }} title={`Arrival on day ${a.day}`} />)}{chartRecovery && <div className="planner-marker bg-status-ok" style={{ left: `${Math.min(98, chartRecovery.arrival_day / scenario.horizon_days * 100)}%` }} title={`Transfer on day ${chartRecovery.arrival_day}`} />}</div>}
            <div className="space-y-2 text-xs">{current?.reserve_days_min != null && <p className="flex items-center gap-2 text-status-warning"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />Day {Number(current.reserve_days_min.toFixed(1))}: protected reserve reached</p>}{current?.arrivals.map((a) => <p key={a.id} className={`flex items-start gap-2 ${a.excluded_reason ? "text-status-warning" : "text-text-secondary"}`}><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" /><span>{a.excluded_reason ? `Arrival excluded: ${a.excluded_reason}` : `Day ${Number(a.day.toFixed(1))}: ${a.quantity} ${current.unit} expected${a.day > scenario.horizon_days ? " (beyond horizon)" : ""}`}</span></p>)}{chartRecovery && <p className="text-status-ok">Day {chartRecovery.arrival_day}: selected transfer arrives</p>}{!current?.arrivals?.length && <p className="text-text-secondary">No expected arrivals recorded for this supply.</p>}</div>
          </section>
        </div>
      </div>

      {result && <div className="grid items-start gap-5 lg:grid-cols-2">
        <section className="glass-card p-5 sm:p-6" aria-label="Station outlook"><p className="planner-eyebrow">Across the network</p><h2 className="mt-2 text-lg font-semibold">Station outlook</h2><p className="mt-1 text-xs text-text-secondary">Coverage applies to recorded items only. Missing inputs remain unassessed.</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{result.stations.filter((s) => s.total > 0).map((s) => <button key={s.id} className={`focus-ring rounded-xl border p-4 text-left transition-colors ${s.status === "watch" ? "border-status-warning/30 bg-status-warning/5" : "border-border hover:bg-accent-soft/40"}`} onClick={() => { setSelectedItem(s.limiting_id || result.forecast.find((f) => f.station_id === s.id)?.id); setSelectedOption(null); }}><p className="text-sm font-medium">{s.name}</p><p className={`mt-2 text-sm font-semibold ${s.status === "watch" ? "text-status-warning" : "text-text-secondary"}`}>{updating ? "Updating…" : s.status === "unknown" ? "Partial / missing inputs" : s.reserve_day != null ? `Reserve in ${Number(s.reserve_day.toFixed(1))} days` : `Covered for ${scenario.horizon_days} days`}</p><p className="mt-2 text-xs text-text-secondary">{s.configured}/{s.total} items assessed{s.unknown ? ` · ${s.unknown} unknown` : ""}</p></button>)}</div>{result.stations.some((s) => !s.total) && <p className="mt-3 text-xs text-text-secondary">{result.stations.filter((s) => !s.total).length} stations have no inventory to assess.</p>}
          {result.links.length > 0 && <div className="mt-5 space-y-3 border-t border-border pt-4"><p className="text-xs font-semibold">Supply connections</p>{result.links.map((l) => <div key={l.id} className="rounded-xl border border-border p-3"><div className="flex items-center gap-2 text-xs"><span className="min-w-0 flex-1 font-medium">{selectedItemName(l.source_id)}</span><span className="shrink-0 text-accent"><ArrowRight size={17} /></span><span className="min-w-0 flex-1 text-right font-medium">{selectedItemName(l.target_id)}</span></div><p className={`mt-2 text-xs ${l.problem ? "text-status-warning" : "text-text-secondary"}`}>{l.problem || `${l.travel_hours}h declared travel · ${l.mode} · ${l.capacity} unit capacity`}</p></div>)}</div>}
        </section>

        <section className="glass-card p-5 sm:p-6" aria-label="Recovery options"><p className="planner-eyebrow">03 · Compare a response</p><h2 className="mt-2 text-lg font-semibold">Recovery options</h2><p className="mt-1 text-xs leading-relaxed text-text-secondary">Each transfer is a separate alternative, assessed against recorded supply and transport constraints. Crew, fuel and departure conditions still need review.</p>
          <div className="mt-4 space-y-3">{result.recoveries.map((r) => <button key={r.id} disabled={updating} aria-pressed={selectedOption === r.id} onClick={() => { setSelectedOption(r.id); if (r.target_id) setSelectedItem(r.target_id); }} className={`focus-ring w-full rounded-xl border p-4 text-left transition-colors disabled:opacity-40 ${selectedOption === r.id ? "border-accent bg-accent-soft/70" : "border-border hover:border-accent/50"}`}><p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-accent">{r.kind === "transfer" ? "Stock transfer · preview" : "Officer review"}</p><p className="text-sm font-semibold">{r.title}</p><p className="mt-1 text-xs leading-relaxed text-text-secondary">{r.detail}</p>{r.kind === "transfer" && <div className="mt-3 flex flex-wrap gap-2 text-xs"><span className="rounded-md bg-status-ok/10 px-2 py-1 text-status-ok">Reserve: {days(r.after_day, scenario.horizon_days)}</span><span className="rounded-md bg-surface-solid px-2 py-1 text-text-secondary">Arrival day {r.arrival_day}</span></div>}</button>)}</div>
          {!result.recoveries.length && <div className="mt-4 rounded-xl border border-dashed border-border p-5 text-sm text-text-secondary">{result.summary.at_risk ? "No feasible recovery option with the recorded inputs. Review approved links, donor reserves and transport availability." : "Change a scenario condition to explore its impact. No recovery action is suggested for the assessed supplies."}</div>}
          {option?.kind === "transfer" && <div className="mt-4 rounded-xl bg-status-ok/5 p-3 text-xs text-text-secondary"><p className="font-medium text-status-ok">Donor reserve remains protected in this projection.</p><p className="mt-1">Minimum projected donor stock after transfer: {option.donor_minimum}; protected reserve: {option.donor_reserve}.</p><p className="mt-2">Approval reference: {option.approval_note}</p></div>}
          {option && <DraftForm key={`${option.id}-${result.as_of}`} result={result} option={option} disabled={updating} onSaved={() => { showToast("Recovery draft saved for review."); setSelectedOption(null); setRevision((v) => v + 1); setTab("drafts"); }} />}
        </section>
      </div>}
      {result?.missions.length > 0 && <section className="glass-card p-5 sm:p-6" aria-label="Affected missions"><h2 className="text-lg font-semibold">Missions requiring review</h2><p className="mt-1 text-xs text-text-secondary">These are planning dependencies across the horizon. Live launch eligibility is checked on the expedition screen.</p><div className="mt-4 grid gap-3 md:grid-cols-2">{result.missions.map((m) => <div key={m.id} className="rounded-xl border border-border p-4"><p className="text-sm font-semibold">{training ? m.name : <Link to={`/expeditions/${m.id}`} className="focus-ring text-accent hover:underline">{m.name}</Link>}</p><ul className="mt-2 space-y-2 pl-4 text-xs leading-relaxed text-text-secondary">{m.issues.map((reason) => <li key={reason} className="list-disc">{reason}</li>)}</ul></div>)}</div></section>}
      <p className="flex items-start gap-2 px-1 text-xs leading-relaxed text-text-secondary"><Snowflake size={14} className="mt-0.5 shrink-0" />Forecasts are conditional estimates based on entered consumption, ETAs and transport approvals. Saving a draft does not reserve resources or execute a transfer. Revalidate operational conditions before acting.</p>
    </div>}
  </div>;
}

export default function MissionPlanner() {
  const [training, setTraining] = useState(false);
  return <PlannerWorkspace key={String(training)} training={training} switchMode={setTraining} />;
}
