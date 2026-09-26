import { useMemo, useState } from "react";
import Reveal from "../ui/Reveal";

const STATUS_COLOR = {
  Active: "bg-status-ok",
  Planned: "bg-border",
  Completed: "bg-text-secondary",
};

export default function ExpeditionTimelineChart({ expeditions, delay = 0 }) {
  // Captured once per mount, not read fresh on every render — Date.now() is
  // an impure render input otherwise.
  const [mountedAt] = useState(() => Date.now());
  const withDates = useMemo(() => expeditions.filter((e) => e.start_date), [expeditions]);
  const { rangeStart, span } = useMemo(() => {
    const starts = withDates.map((e) => new Date(e.start_date).getTime());
    const ends = withDates.map((e) => new Date(e.end_date || e.start_date).getTime());
    const start = starts.length ? Math.min(...starts) : mountedAt;
    const end = Math.max(...ends, mountedAt);
    return { rangeStart: start, span: Math.max(end - start, 1) };
  }, [withDates, mountedAt]);

  return (
    <Reveal delay={delay} className="glass-card p-5">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-text-primary">Expedition Timeline</h2>
        <p className="text-sm text-text-secondary">Planned, active & completed routes by start/end date</p>
      </div>
      {withDates.length === 0 ? (
        <p className="flex h-32 items-center justify-center text-sm text-text-secondary">No expeditions yet.</p>
      ) : (
        <div className="space-y-2.5">
          {withDates.map((exp) => {
            const start = new Date(exp.start_date).getTime();
            const end = new Date(exp.end_date || exp.start_date).getTime();
            const leftPct = ((start - rangeStart) / span) * 100;
            const widthPct = Math.max(((end - start) / span) * 100, 1.2);
            return (
              <div key={exp.id} className="flex items-center gap-3">
                <p className="w-40 shrink-0 truncate text-xs text-text-secondary" title={exp.name}>
                  {exp.name}
                </p>
                <div className="relative h-2.5 flex-1 rounded-full bg-accent-soft/40">
                  <div
                    className={`absolute h-2.5 rounded-full ${STATUS_COLOR[exp.status] ?? "bg-border"}`}
                    style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                    title={`${exp.start_date} → ${exp.end_date ?? "ongoing"}`}
                  />
                </div>
              </div>
            );
          })}
          <div className="flex items-center gap-4 pt-1 text-[11px] text-text-secondary">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-status-ok" /> Active
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-border" /> Planned
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-text-secondary" /> Completed
            </span>
          </div>
        </div>
      )}
    </Reveal>
  );
}
