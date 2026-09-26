const TONES = {
  ok: "bg-status-ok/10 text-status-ok",
  warning: "bg-status-warning/10 text-status-warning",
  critical: "bg-status-critical/10 text-status-critical",
  neutral: "bg-border/40 text-text-secondary",
};

export default function StatusBadge({ label, tone = "neutral" }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${TONES[tone]}`}>
      {label}
    </span>
  );
}
