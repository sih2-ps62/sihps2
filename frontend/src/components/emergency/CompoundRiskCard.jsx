import { TriangleAlert } from "lucide-react";
import Reveal from "../ui/Reveal";

// Inline CSS custom property, not a Tailwind class — the risk-pulse keyframe
// (tailwind.config.js) reads --pulse-color via var(), which only works with
// a real color value. These mirror the status-critical/warning/text-secondary
// tokens in tailwind.config.js; kept in sync manually since this one value
// can't be expressed as a Tailwind class.
const SEVERITY_STYLES = {
  CRITICAL: { textClass: "text-status-critical", pulseColor: "rgba(220, 38, 38, 0.35)" },
  HIGH: { textClass: "text-status-warning", pulseColor: "rgba(217, 119, 6, 0.35)" },
  MEDIUM: { textClass: "text-text-secondary", pulseColor: "rgba(92, 124, 144, 0.3)" },
};

const KIND_DOT = {
  low_stock: "bg-status-warning",
  overdue_personnel: "bg-status-critical",
  emergency: "bg-status-critical",
};

function buildBullets(conditions) {
  const lowStock = conditions.filter((c) => c.kind === "low_stock");
  const overdue = conditions.filter((c) => c.kind === "overdue_personnel");
  const emergencies = conditions.filter((c) => c.kind === "emergency");

  const bullets = [
    ...lowStock.map((c) => ({ kind: "low_stock", text: c.label })),
    ...emergencies.map((c) => ({ kind: "emergency", text: `${c.label} (open)` })),
  ];

  if (overdue.length > 0) {
    bullets.push({
      kind: "overdue_personnel",
      text: `${overdue.length} personnel check-in${overdue.length > 1 ? "s" : ""} overdue (${overdue
        .map((c) => c.label)
        .join(", ")})`,
    });
  }

  return bullets;
}

export default function CompoundRiskCard({ stationName, risk, delay = 0 }) {
  const style = SEVERITY_STYLES[risk.severity] ?? SEVERITY_STYLES.MEDIUM;
  const bullets = buildBullets(risk.conditions);
  const kindCount = new Set(risk.conditions.map((c) => c.kind)).size;

  return (
    // Two elements, not one: Reveal's fade-slide-up and the risk-pulse glow
    // both set the CSS `animation` shorthand, so they'd silently overwrite
    // each other on a single element. Reveal handles entrance on the
    // wrapper; the inner div owns the one-shot pulse independently.
    <Reveal delay={delay}>
      <div
        style={{ "--pulse-color": style.pulseColor }}
        className="glass-card animate-risk-pulse flex flex-col gap-3 border-2 p-6"
      >
        <div className="flex items-center gap-3">
          <TriangleAlert size={22} strokeWidth={1.75} className={style.textClass} />
          <h3 className="text-lg font-semibold uppercase tracking-wide text-text-primary">{stationName}</h3>
        </div>
        <p className="text-sm text-text-secondary">{kindCount} related conditions detected</p>

        <ul className="flex flex-col gap-2">
          {bullets.map((bullet, idx) => (
            <li key={idx} className="flex items-start gap-2.5 text-sm text-text-primary">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${KIND_DOT[bullet.kind]}`} aria-hidden="true" />
              {bullet.text}
            </li>
          ))}
        </ul>

        <p className={`text-sm font-bold ${style.textClass}`}>Operational Priority: {risk.severity}</p>
        <p className="text-xs text-text-secondary">
          Multiple independent conditions are affecting the same station at the same time.
        </p>
      </div>
    </Reveal>
  );
}
