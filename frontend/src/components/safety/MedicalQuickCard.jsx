import { useCallback, useEffect, useRef, useState } from "react";
import { HeartPulse, LockKeyhole, ShieldCheck } from "lucide-react";
import { api } from "../../lib/api";
import { useQuery } from "../../hooks/useApi";
import Button from "../ui/Button";
import Field, { inputClass } from "../ui/FormField";

export default function MedicalQuickCard({ kind, recordId }) {
  const { data: permission, error: permissionError } = useQuery(() => api.get("/medical/permission"), []);
  const [record, setRecord] = useState(null);
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [expiresAt, setExpiresAt] = useState(null);
  const access = useRef(null);
  const generation = useRef(0);
  const path = `/medical/records/${kind}/${recordId}`;
  const lock = useCallback(() => {
    generation.current += 1;
    const token = access.current;
    access.current = null;
    setRecord(null); setPassword(""); setExpiresAt(null); setBusy(false);
    if (token) api.post("/medical/lock", {}, { headers: { "X-Medical-Access": token } }).catch(() => {});
  }, []);
  useEffect(() => {
    const hide = () => { if (document.hidden) lock(); };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("blur", lock);
    return () => { document.removeEventListener("visibilitychange", hide); window.removeEventListener("blur", lock); lock(); };
  }, [lock, recordId, kind]);
  useEffect(() => {
    if (!expiresAt) return;
    const timer = setTimeout(lock, Math.max(0, new Date(expiresAt).getTime() - Date.now()));
    return () => clearTimeout(timer);
  }, [expiresAt, lock]);

  const unlock = async (event) => {
    event.preventDefault(); setBusy(true); setError("");
    const current = ++generation.current;
    try {
      const grant = await api.post("/medical/access", { scope: `${kind}:${recordId}`, password, reason });
      setPassword("");
      const token = grant.data.access_token;
      if (current !== generation.current) {
        api.post("/medical/lock", {}, { headers: { "X-Medical-Access": token } }).catch(() => {});
        return;
      }
      access.current = token;
      setExpiresAt(grant.data.expires_at);
      const result = await api.get(path, undefined, { headers: { "X-Medical-Access": token } });
      if (current === generation.current) setRecord(result.data);
    } catch (err) { if (current === generation.current) { lock(); setError(err.message); } }
    finally { if (current === generation.current) setBusy(false); setPassword(""); }
  };
  const save = async () => {
    const current = generation.current;
    setBusy(true); setError("");
    try {
      const result = await api.patch(path, { blood_type: record.blood_type, allergies: record.allergies, known_conditions: record.known_conditions },
        { headers: { "X-Medical-Access": access.current } });
      if (current === generation.current) setRecord(result.data);
    } catch (err) { if (current === generation.current) { lock(); setError(err.message); } }
    finally { if (current === generation.current) setBusy(false); }
  };
  return <section className="space-y-4 rounded-2xl border border-border bg-surface p-5" aria-label="Restricted critical information">
    <div className="flex flex-wrap items-center justify-between gap-3"><div>
      <h2 className="flex items-center gap-2 text-lg font-semibold"><HeartPulse size={20} className="text-status-critical" /> {kind === "incident" ? "Critical-info quick-card" : "Critical-info registration"}</h2>
      <p className="mt-1 text-xs text-text-secondary">Restricted clinical information · Access is separately authorized and audited.</p>
    </div><LockKeyhole size={20} className="text-text-secondary" /></div>
    {record ? <>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-accent-soft p-3 text-xs">
        <span className="flex items-center gap-2 text-accent"><ShieldCheck size={16} /> Unlocked until {new Date(expiresAt).toLocaleTimeString()} · Locks when you leave this window</span>
        <button className="focus-ring rounded font-semibold text-text-primary" onClick={lock}>Lock now</button>
      </div>
      <p className="text-sm font-semibold">{record.personnel_name}</p>
      {!record.registered && <p className="text-sm text-status-warning">No pre-registered critical information. Unknown does not mean no allergies or conditions.</p>}
      {kind === "profile" ? <div className="space-y-3">
        <Field label="Blood type"><select className={inputClass} value={record.blood_type} onChange={(e) => setRecord({ ...record, blood_type: e.target.value })}>
          {["Unknown", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((v) => <option key={v}>{v}</option>)}
        </select></Field>
        <Field label="Allergies"><textarea className={inputClass} rows={2} maxLength={2000} value={record.allergies} onChange={(e) => setRecord({ ...record, allergies: e.target.value })} /></Field>
        <Field label="Known conditions"><textarea className={inputClass} rows={2} maxLength={2000} value={record.known_conditions} onChange={(e) => setRecord({ ...record, known_conditions: e.target.value })} /></Field>
        <p className="text-xs text-text-secondary">Use “Not recorded” for unknown information. Register information confirmed with the person or the medical team.</p>
        <Button disabled={busy || !record.allergies.trim() || !record.known_conditions.trim()} onClick={save}>{busy ? "Saving…" : "Save critical information"}</Button>
      </div> : <dl className="grid gap-4 sm:grid-cols-3">
        {[ ["Blood type", record.blood_type], ["Allergies", record.allergies], ["Known conditions", record.known_conditions] ].map(([label, value]) => <div key={label} className="rounded-xl border border-border p-3"><dt className="text-xs text-text-secondary">{label}</dt><dd className="mt-2 whitespace-pre-wrap break-words text-sm font-semibold">{value}</dd></div>)}
      </dl>}
      {record.updated_at && <p className="text-xs text-text-secondary">Last registered: {new Date(record.updated_at).toLocaleString()}</p>}
    </> : permission?.data?.permitted ? <form className="space-y-3" onSubmit={unlock}>
      <p className="text-sm text-text-secondary">Confirm your password and the reason for access. This record stays unlocked for up to 5 minutes.</p>
      <Field label="Reason for clinical access"><input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} minLength={8} maxLength={500} required placeholder={kind === "incident" ? "Responding to this person's incident" : "Pre-departure medical registration"} /></Field>
      <Field label="Confirm your password"><input type="password" autoComplete="current-password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
      <Button type="submit" icon={LockKeyhole} disabled={busy}>{busy ? "Verifying…" : "Unlock critical information"}</Button>
    </form> : <p className="rounded-xl border border-border p-4 text-sm text-text-secondary">{permissionError ? permissionError.message : permission ? "Locked. A designated medical account is required. Admin and duty-officer roles do not automatically grant medical access." : "Checking medical-access permission…"}</p>}
    {error && <p role="alert" className="text-sm text-status-critical">{error}</p>}
  </section>;
}
