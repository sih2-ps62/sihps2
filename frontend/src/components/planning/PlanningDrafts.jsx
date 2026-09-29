import { useState } from "react";
import { ArrowUpRight, FileText } from "lucide-react";
import Button from "../ui/Button";
import { useQuery } from "../../hooks/useApi";
import { api } from "../../lib/api";
import { days } from "../../lib/planning";

function DraftDetail({ id, onClose }) {
  const { data, isLoading, error, refetch } = useQuery(() => api.get(`/planning/drafts/${id}`), [id]);
  const draft = data?.data;
  if (error) return <div role="alert" className="glass-card p-5"><p>{error.message}</p><Button variant="ghost" onClick={refetch}>Retry</Button></div>;
  if (isLoading || !draft) return <p role="status" className="p-5 text-sm text-text-secondary">Loading saved plan…</p>;
  const { evaluation, selected_option: option, inputs } = draft.snapshot;
  const horizon = evaluation.scenario.horizon_days;
  function download() {
    const content = [
      `# ${draft.title}`, "", `${draft.training ? "TRAINING EXERCISE — fictional data" : "OPERATIONS"} · DRAFT FOR REVIEW`,
      `Saved by ${draft.created_by} at ${draft.created_at}`, `Forecast as of ${evaluation.as_of}`, "",
      `Reason: ${draft.reason}`, "", `## Selected action`, option.title, option.detail, option.assumptions, "",
      `## Scenario`, `Planning horizon: ${horizon} days`, `Supply delay: ${evaluation.scenario.delay_hours} hours`,
      ...["delay_station_id", "closed_link_id", "unavailable_asset_id", "unavailable_person_id"].filter((k) => evaluation.scenario[k]).map((k) => `${k.replaceAll("_", " ")}: ${evaluation.scenario[k]}`),
      "", "## Stock and assumptions at review", ...inputs.items.map((i) => `${i.name} (${i.id}): ${i.quantity} ${i.unit}. ${i.profile ? `${i.profile.daily_min}–${i.profile.daily_max} per ${i.profile.basis} per day; headcount ${i.profile.headcount ?? "n/a"}; reserve ${i.profile.reserve}. ${i.profile.note}` : "Consumption unknown."}`),
      "", "## Mission dependencies", ...evaluation.missions.flatMap((m) => [m.name, ...m.issues.map((r) => `- ${r}`)]),
      "", "Forecasts are conditional on recorded inputs. Alternatives are independent. No inventory, dispatch or expedition changes have been executed. Revalidate conditions and departure controls before action.",
    ].join("\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/markdown;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `${draft.id}.md`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className="glass-card border-accent/40 p-5 sm:p-6" aria-label="Saved draft detail">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="planner-eyebrow">{draft.training ? "Training exercise" : "Operations"} · Draft for review</p><h3 className="mt-2 text-lg font-semibold">{draft.title}</h3></div><Button variant="ghost" onClick={onClose}>Close plan</Button></div>
    <p className="mt-2 text-xs text-text-secondary">Saved by {draft.created_by} · {new Date(draft.created_at).toLocaleString()} · Forecast as of {new Date(evaluation.as_of).toLocaleString()}</p>
    <div className="mt-5 rounded-xl border border-border bg-accent-soft/40 p-4"><p className="font-semibold">{option.title}</p><p className="mt-1 text-sm text-text-secondary">{option.detail}</p>{option.kind === "transfer" && <p className="mt-2 text-sm">Reserve projection: {days(option.before_day, horizon)} → {days(option.after_day, horizon)}. Arrival: day {option.arrival_day}.</p>}<p className="mt-3 text-sm">Officer’s reason: {draft.reason}</p></div>
    <p className="mt-3 text-xs text-text-secondary">{horizon}-day horizon · {evaluation.scenario.delay_hours}h supply delay · {option.assumptions}</p>
    <details className="mt-5 rounded-xl border border-border p-4"><summary className="focus-ring text-sm font-medium">View assumptions saved with this plan</summary><div className="mt-3 divide-y divide-border">{inputs.items.map((i) => <div key={i.id} className="py-3 text-sm"><p className="font-medium">{i.name} · {i.quantity} {i.unit} on hand</p><p className="mt-1 text-xs text-text-secondary">{i.profile ? `${i.profile.daily_min}–${i.profile.daily_max} per ${i.profile.basis}/day · reserve ${i.profile.reserve} ${i.unit}${i.profile.headcount ? ` · ${i.profile.headcount} people` : ""}. ${i.profile.note}` : "Consumption not recorded"}</p></div>)}</div></details>
    <div className="mt-5 flex flex-wrap items-center gap-4"><Button variant="ghost" icon={FileText} onClick={download}>Download plan</Button><p className="text-xs text-text-secondary">A saved proposal. Dispatch and stock changes require separate action.</p></div>
  </section>;
}

export default function PlanningDrafts({ revision }) {
  const { data, isLoading, error, refetch } = useQuery(() => api.get("/planning/drafts"), [revision]);
  const [selected, setSelected] = useState(null);
  return <div className="space-y-5">
    <div className="glass-card p-5"><h2 className="font-semibold">Plans ready for a human decision.</h2><p className="mt-1 text-sm text-text-secondary">Each draft preserves its scenario, source inputs and selected action. Reviewing a saved plan shows the original calculation.</p></div>
    {selected && <DraftDetail key={selected} id={selected} onClose={() => setSelected(null)} />}
    {error && <p role="alert" className="text-sm text-status-critical">{error.message} <button onClick={refetch} className="underline">Retry</button></p>}
    {isLoading && <p role="status" className="text-sm text-text-secondary">Loading drafts…</p>}
    {data?.data?.map((draft) => <button key={draft.id} onClick={() => setSelected(draft.id)} className="glass-card focus-ring flex w-full items-center justify-between gap-4 p-5 text-left transition-colors hover:border-accent">
      <div className="min-w-0"><p className="planner-eyebrow">{draft.training ? "Training exercise" : "Operations"} · Draft</p><p className="mt-2 font-semibold">{draft.title}</p><p className="mt-1 text-sm text-text-secondary">{draft.option_title}</p><p className="mt-2 text-xs text-text-secondary">{draft.created_by} · {new Date(draft.created_at).toLocaleString()}</p></div><ArrowUpRight className="shrink-0 text-accent" size={20} />
    </button>)}
    {data?.data?.length === 0 && <div className="glass-card p-10 text-center"><FileText className="mx-auto mb-3 text-accent" /><p className="font-medium">Your first recovery plan starts in the scenario lab.</p><p className="mt-2 text-sm text-text-secondary">Select an option, record your reason and save a draft for review.</p></div>}
  </div>;
}
