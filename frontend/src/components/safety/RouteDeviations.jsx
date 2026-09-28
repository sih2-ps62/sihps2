import { useState } from "react";
import { RouteOff } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { inputClass } from "../ui/FormField";
import Button from "../ui/Button";

export default function RouteDeviations({ events, onReviewed }) {
  const [notes, setNotes] = useState({});
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  if (!events.length) return null;
  const review = async (event) => {
    setBusy(event.id); setError("");
    try { await api.post(`/safety/checkins/${event.id}/review`, { note: notes[event.id] || "" }); onReviewed(); }
    catch (err) { setError(err.message); }
    finally { setBusy(null); }
  };
  return <section className="space-y-3 rounded-2xl border border-status-warning/40 bg-status-warning/5 p-4" aria-label="Route deviation alerts">
    <h3 className="flex items-center gap-2 text-sm font-semibold text-status-warning"><RouteOff size={18} /> Off-plan station check-ins · {events.length}</h3>
    <p className="text-xs text-text-secondary">A route mismatch needs verification. It does not establish the person's live position.</p>
    {events.map((event) => <div key={event.id} className="space-y-2 rounded-xl border border-border bg-surface p-3">
      <p className="text-sm"><Link to={`/personnel/${event.personnel_id}`} className="font-semibold text-accent hover:underline">{event.personnel_name}</Link> reported at {event.station_name}; expected {event.expected_station_name}.</p>
      <p className="text-xs text-text-secondary">{new Date(event.timestamp).toLocaleString()} · {event.expedition_id}</p>
      <div className="flex flex-wrap gap-2"><input aria-label={`Review note for ${event.personnel_name}`} className={`${inputClass} min-w-48 flex-1`} maxLength={1000}
        placeholder="Record radio verification or an approved route change" value={notes[event.id] || ""} onChange={(e) => setNotes({ ...notes, [event.id]: e.target.value })} />
        <Button variant="ghost" disabled={busy !== null || (notes[event.id] || "").trim().length < 8} onClick={() => review(event)}>{busy === event.id ? "Saving…" : "Mark reviewed"}</Button></div>
    </div>)}
    {error && <p role="alert" className="text-sm text-status-critical">{error}</p>}
  </section>;
}
